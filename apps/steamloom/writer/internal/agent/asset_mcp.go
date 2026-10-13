package agent

import (
	"bufio"
	"bytes"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path/filepath"
	"strings"
	"time"
)

const (
	assetMCPServerName = "SteamLoomWriterGrant"
	assetMCPToolName   = "writer_upload_approved_asset"
)

type assetMCPServer struct {
	agentID, projectID, threadID, proposalID, grantID string
	used                                              map[string]bool
}

type assetMCPRequest struct {
	JSONRPC string          `json:"jsonrpc"`
	ID      json.RawMessage `json:"id,omitempty"`
	Method  string          `json:"method"`
	Params  json.RawMessage `json:"params,omitempty"`
}

// ServeAssetMCP 是 apply turn 臨時啟動的本機 stdio tool；只代理核准圖片到 S3，不接 SteamLoom MCP／DB。
func ServeAssetMCP(input io.Reader, output io.Writer, agentID, projectID, threadID, proposalID, grantID string) error {
	server := assetMCPServer{agentID: agentID, projectID: projectID, threadID: threadID, proposalID: proposalID, grantID: grantID, used: map[string]bool{}}
	scanner := bufio.NewScanner(input)
	scanner.Buffer(make([]byte, 64*1024), 2*1024*1024)
	encoder := json.NewEncoder(output)
	for scanner.Scan() {
		var request assetMCPRequest
		if json.Unmarshal(scanner.Bytes(), &request) != nil || request.JSONRPC != "2.0" {
			continue
		}
		if len(request.ID) == 0 {
			continue
		}
		result, rpcErr := server.handle(request)
		response := map[string]any{"jsonrpc": "2.0", "id": request.ID}
		if rpcErr != nil {
			response["error"] = map[string]any{"code": -32000, "message": rpcErr.Error()}
		} else {
			response["result"] = result
		}
		if err := encoder.Encode(response); err != nil {
			return err
		}
	}
	return scanner.Err()
}

func (s *assetMCPServer) handle(request assetMCPRequest) (any, error) {
	switch request.Method {
	case "initialize":
		var params struct {
			ProtocolVersion string `json:"protocolVersion"`
		}
		_ = json.Unmarshal(request.Params, &params)
		if params.ProtocolVersion == "" {
			params.ProtocolVersion = "2025-06-18"
		}
		return map[string]any{"protocolVersion": params.ProtocolVersion, "capabilities": map[string]any{"tools": map[string]any{}}, "serverInfo": map[string]any{"name": assetMCPServerName, "version": "1"}}, nil
	case "ping":
		return map[string]any{}, nil
	case "tools/list":
		return map[string]any{"tools": []any{map[string]any{
			"name":        assetMCPToolName,
			"description": "Upload one image item from the currently approved Writer proposal to its SteamLoom S3 presigned URL.",
			"inputSchema": map[string]any{"type": "object", "additionalProperties": false, "required": []string{"item_id", "upload_url", "tagging"}, "properties": map[string]any{
				"item_id": map[string]any{"type": "string"}, "upload_url": map[string]any{"type": "string"}, "tagging": map[string]any{"type": "string"},
			}},
		}}}, nil
	case "tools/call":
		var params struct {
			Name      string `json:"name"`
			Arguments struct {
				ItemID    string `json:"item_id"`
				UploadURL string `json:"upload_url"`
				Tagging   string `json:"tagging"`
			} `json:"arguments"`
		}
		if err := json.Unmarshal(request.Params, &params); err != nil || params.Name != assetMCPToolName {
			return nil, errors.New("不支援的 Writer grant tool")
		}
		if s.used[params.Arguments.ItemID] {
			return nil, errors.New("這張核准圖片已經上傳")
		}
		if err := putApprovedAsset(s.agentID, s.projectID, s.threadID, s.proposalID, params.Arguments.ItemID, s.grantID, params.Arguments.UploadURL, params.Arguments.Tagging); err != nil {
			return map[string]any{"content": []any{map[string]any{"type": "text", "text": err.Error()}}, "isError": true}, nil
		}
		s.used[params.Arguments.ItemID] = true
		return map[string]any{"content": []any{map[string]any{"type": "text", "text": "核准圖片已上傳"}}}, nil
	default:
		return nil, fmt.Errorf("不支援的 MCP method：%s", request.Method)
	}
}

func putApprovedAsset(agentID, projectID, threadID, proposalID, itemID, grantID, uploadURL, tagging string) error {
	if err := validChatKey(agentID, projectID); err != nil {
		return err
	}
	if !validThread(threadID) || !validThread(proposalID) || !validThread(itemID) || !validThread(grantID) {
		return errors.New("圖片上傳 grant 不正確")
	}
	chatMu.Lock()
	raw, mimeType, err := approvedAssetPayload(agentID, projectID, threadID, proposalID, itemID, grantID)
	chatMu.Unlock()
	if err != nil {
		return err
	}
	parsed, err := validatePresignedUploadURL(uploadURL)
	if err != nil {
		return err
	}
	request, err := http.NewRequest(http.MethodPut, parsed.String(), bytes.NewReader(raw))
	if err != nil {
		return err
	}
	request.Header.Set("Content-Type", mimeType)
	request.Header.Set("x-amz-tagging", tagging)
	client := &http.Client{Timeout: 2 * time.Minute, CheckRedirect: func(*http.Request, []*http.Request) error { return errors.New("圖片上傳網址不可重新導向") }}
	response, err := client.Do(request)
	if err != nil {
		return fmt.Errorf("圖片上傳失敗：%w", err)
	}
	defer response.Body.Close()
	if response.StatusCode < 200 || response.StatusCode >= 300 {
		return fmt.Errorf("圖片上傳失敗：HTTP %d", response.StatusCode)
	}
	return nil
}

// approvedAssetPayload 在 chat lock 內同時核對 event log 與 proposal snapshot；即使重啟時
// proposal.json 尚未來得及改寫，只要 apply.interrupted 已落盤，舊 grant 也會立即失效。
func approvedAssetPayload(agentID, projectID, threadID, proposalID, itemID, grantID string) ([]byte, string, error) {
	dir, idx, err := loadChat(agentID, projectID)
	if err != nil {
		return nil, "", err
	}
	if !hasThread(idx, threadID) {
		return nil, "", errors.New("找不到這段對話")
	}
	proposalDir := filepath.Join(dir, "proposals", threadID, proposalID)
	proposal, err := readProposal(filepath.Join(proposalDir, "proposal.json"))
	if err != nil {
		return nil, "", err
	}
	lifecycle, exists := proposalApplyLifecycle(filepath.Join(dir, threadID+".jsonl"), proposal.ID)
	if !exists || lifecycle.status != ProposalApplying || proposal.Status != ProposalApplying || proposal.GrantID != grantID {
		return nil, "", errors.New("圖片上傳 grant 已失效")
	}
	expiresAt, err := time.Parse(time.RFC3339, proposal.GrantExpiresAt)
	if err != nil || time.Now().After(expiresAt) {
		return nil, "", errors.New("圖片上傳 grant 已過期")
	}
	if err := verifyProposalHashes(proposal); err != nil {
		return nil, "", err
	}
	var item *ProposalItem
	for index := range proposal.Items {
		if proposal.Items[index].ID == itemID && proposal.Items[index].Kind == ProposalKindAsset {
			item = &proposal.Items[index]
			break
		}
	}
	if item == nil {
		return nil, "", errors.New("找不到核准的圖片成果")
	}
	raw, err := readVerifiedProposalAsset(*item, proposalDir)
	if err != nil {
		return nil, "", err
	}
	return raw, item.MIMEType, nil
}

func validatePresignedUploadURL(raw string) (*url.URL, error) {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || parsed.Scheme != "https" || parsed.User != nil || parsed.Hostname() == "" {
		return nil, errors.New("圖片上傳網址不正確")
	}
	host := strings.ToLower(parsed.Hostname())
	if host != "s3.amazonaws.com" && !strings.HasSuffix(host, ".amazonaws.com") && !strings.HasSuffix(host, ".amazonaws.com.cn") {
		return nil, errors.New("圖片上傳網址不是 AWS S3")
	}
	query := parsed.Query()
	if query.Get("X-Amz-Signature") == "" || query.Get("X-Amz-Credential") == "" || query.Get("X-Amz-Expires") == "" {
		return nil, errors.New("圖片上傳網址缺少 presigned signature")
	}
	return parsed, nil
}
