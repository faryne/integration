package agent

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"sort"
	"strings"
)

const (
	applyEnvelopeStart = "<<<STEAMLOOM_WRITER_APPLY_RESULT_V1>>>"
	applyEnvelopeEnd   = "<<<END_STEAMLOOM_WRITER_APPLY_RESULT_V1>>>"
)

var errApplyConflict = errors.New("核准內容的基準版本已經變更")

// ApprovalGrant 只活在這次 apply turn；tool allowlist 與 proposal hash 都由 Writer 從已核准成果產生。
type ApprovalGrant struct {
	ID          string         `json:"grant_id"`
	ProposalID  string         `json:"proposal_id"`
	ProjectID   string         `json:"project_id"`
	ContentHash string         `json:"content_hash"`
	ExpiresAt   string         `json:"expires_at"`
	Items       []ProposalItem `json:"items"`
	Tools       []string       `json:"-"`
	AssetTool   string         `json:"asset_upload_tool,omitempty"`
	assetMCP    *assetMCPInvocation
}

type assetMCPInvocation struct {
	Command string
	Args    []string
}

type ApplyResult struct {
	ProposalID  string `json:"proposal_id"`
	ContentHash string `json:"content_hash"`
	Status      string `json:"status"`
	Error       string `json:"error,omitempty"`
}

func newApprovalGrant(proposal Proposal) (ApprovalGrant, error) {
	if proposal.Status != ProposalApplying || proposal.GrantID == "" || proposal.GrantExpiresAt == "" {
		return ApprovalGrant{}, errors.New("提案尚未進入可執行狀態")
	}
	tools := map[string]bool{}
	hasAsset := false
	for _, item := range proposal.Items {
		if item.Kind == ProposalKindAsset {
			hasAsset = true
		}
		for _, operation := range item.Operations {
			tools[operation.Tool] = true
		}
	}
	toolNames := make([]string, 0, len(tools))
	for tool := range tools {
		toolNames = append(toolNames, tool)
	}
	sort.Strings(toolNames)
	grant := ApprovalGrant{
		ID: proposal.GrantID, ProposalID: proposal.ID, ProjectID: proposal.ProjectID, ContentHash: proposal.ContentHash,
		ExpiresAt: proposal.GrantExpiresAt, Items: proposal.Items, Tools: toolNames,
	}
	if hasAsset {
		executable, err := os.Executable()
		if err != nil {
			return ApprovalGrant{}, err
		}
		grant.AssetTool = assetMCPToolName
		grant.assetMCP = &assetMCPInvocation{Command: executable, Args: []string{"--asset-mcp", proposal.AgentID, proposal.ProjectID, proposal.ThreadID, proposal.ID, proposal.GrantID}}
	}
	return grant, nil
}

func (grant ApprovalGrant) body(title string) string {
	payload, _ := json.Marshal(grant)
	assetRules := ""
	if grant.AssetTool != "" {
		assetRules = fmt.Sprintf("\n圖片項目必須依序呼叫 presign operation、%s、confirm operation。%s 只接受 item_id、presign 回傳的 upload_url 與 tagging，並且只能上傳這次 grant 中 hash 相符的圖片；不得改用 shell 或其他網路工具。\n", grant.AssetTool, grant.AssetTool)
	}
	return fmt.Sprintf(`你正在 SteamLoom Writer 的同一條 Agent thread 執行作者已核准的寫回。專案是〈%s〉（project_public_id: %s）。

這是一張一次性 grant，只允許執行 JSON 內列出的 operations，並且必須按照 item 與 operation 順序處理。既有 arguments 是作者看過的固定值，不得自行修改、增加其他目標或呼叫未列出的 mutation；只有前一步回傳後才知道的 presigned key／upload_url 等欄位可以帶入下一步。故事／設定更新的 abort_on_conflict 必須維持 true；若 tool 回報版本衝突，不得重送或改成覆寫。不要重新產生內容，也不要再次提交 proposal。
%s
Grant：
%s

完成後先用自然語言清楚說明實際寫入結果，再附上獨立結果區塊。成功時 status 必須是 completed；版本衝突時用 conflict；其他 operation 未執行或失敗時用 failed。conflict／failed 都必須填 error。proposal_id 與 content_hash 必須原樣回傳。
%s
{"proposal_id":"%s","content_hash":"%s","status":"completed"}
%s`, title, grant.ProjectID, assetRules, payload, applyEnvelopeStart, grant.ProposalID, grant.ContentHash, applyEnvelopeEnd)
}

func parseApplyResultEnvelope(answer string, grant ApprovalGrant) (string, *ApplyResult, error) {
	start := strings.LastIndex(answer, applyEnvelopeStart)
	if start < 0 {
		return "", nil, errors.New("Agent 沒有回傳寫入結果")
	}
	endOffset := strings.Index(answer[start+len(applyEnvelopeStart):], applyEnvelopeEnd)
	if endOffset < 0 {
		return "", nil, errors.New("Agent 回傳的寫入結果缺少結束標記")
	}
	end := start + len(applyEnvelopeStart) + endOffset
	if strings.TrimSpace(answer[end+len(applyEnvelopeEnd):]) != "" {
		return "", nil, errors.New("寫入結果結束後不能再附加內容")
	}
	decoder := json.NewDecoder(strings.NewReader(strings.TrimSpace(answer[start+len(applyEnvelopeStart) : end])))
	decoder.DisallowUnknownFields()
	var result ApplyResult
	if err := decoder.Decode(&result); err != nil {
		return "", nil, fmt.Errorf("Agent 回傳的寫入結果不正確：%w", err)
	}
	if err := ensureJSONEOF(decoder); err != nil {
		return "", nil, err
	}
	visible := strings.TrimSpace(answer[:start])
	if visible == "" {
		return "", nil, errors.New("Agent 回傳寫入結果時必須附上對作者可讀的摘要")
	}
	if result.ProposalID != grant.ProposalID || result.ContentHash != grant.ContentHash {
		return "", nil, errors.New("Agent 回傳的寫入結果不屬於核准提案")
	}
	if result.Status != "completed" && result.Status != "failed" && result.Status != "conflict" {
		return "", nil, errors.New("Agent 回傳的寫入狀態不正確")
	}
	if result.Status != "completed" && strings.TrimSpace(result.Error) == "" {
		return "", nil, errors.New("Agent 回報寫入未完成時必須提供原因")
	}
	return visible, &result, nil
}
