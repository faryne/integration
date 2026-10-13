package agent

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"strings"
)

const (
	ProposalAwaitingConfirmation = "awaiting_confirmation"
	ProposalApproved             = "approved"
	ProposalRejected             = "rejected"
	ProposalDecisionApprove      = "approve"
	ProposalDecisionReject       = "reject"
	ProposalApplying             = "applying"
	ProposalApplied              = "applied"
	ProposalConflict             = "conflict"
	ProposalVerificationRequired = "verification_required"
	ProposalApplyFailed          = "apply_failed"
	ProposalKindStory            = "story"
	ProposalKindLore             = "lore"
	ProposalKindAsset            = "asset"
)

// Proposal 是單一 task 交付的一批成果；使用者之後預設整批審查，但授權仍逐 item 綁定 hash。
type Proposal struct {
	ID             string         `json:"id"`
	TaskID         string         `json:"task_id"`
	ThreadID       string         `json:"thread_id"`
	AgentID        string         `json:"agent_id"`
	ProjectID      string         `json:"project_id"`
	Status         string         `json:"status"`
	ContentHash    string         `json:"content_hash"`
	CreatedAt      string         `json:"created_at"`
	DecidedAt      string         `json:"decided_at,omitempty"`
	GrantID        string         `json:"grant_id,omitempty"`
	GrantExpiresAt string         `json:"grant_expires_at,omitempty"`
	AppliedAt      string         `json:"applied_at,omitempty"`
	InterruptedAt  string         `json:"interrupted_at,omitempty"`
	Items          []ProposalItem `json:"items"`
}

// ProposalSnapshot 保存 Agent 產生提案時讀到的版本，供 review 時判斷 DB 是否已前進。
type ProposalSnapshot struct {
	Title       string `json:"title,omitempty"`
	Summary     string `json:"summary,omitempty"`
	ContentType string `json:"content_type,omitempty"`
	Content     string `json:"content,omitempty"`
}

// ProposalOperation 保存確認後 Agent 可能呼叫的 tool 與參數；圖片上傳可有 presign／confirm 多步。
type ProposalOperation struct {
	Tool      string         `json:"tool"`
	Arguments map[string]any `json:"arguments"`
}

// ProposalItem 同時涵蓋故事、設定與圖片資產；Operations 是後續 grant 必須逐項約束的操作。
type ProposalItem struct {
	ID            string              `json:"id"`
	Kind          string              `json:"kind"`
	Operations    []ProposalOperation `json:"operations"`
	TargetID      string              `json:"target_id,omitempty"`
	BaseVersionID string              `json:"base_version_id,omitempty"`
	Title         string              `json:"title,omitempty"`
	Summary       string              `json:"summary,omitempty"`
	ContentType   string              `json:"content_type,omitempty"`
	Content       string              `json:"content,omitempty"`
	Base          *ProposalSnapshot   `json:"base,omitempty"`
	LocalPath     string              `json:"local_path,omitempty"`
	FileName      string              `json:"file_name,omitempty"`
	MIMEType      string              `json:"mime_type,omitempty"`
	FileSize      int64               `json:"file_size,omitempty"`
	FileSHA256    string              `json:"file_sha256,omitempty"`
	AltText       string              `json:"alt_text,omitempty"`
	CollectionID  string              `json:"collection_id,omitempty"`
	ContentHash   string              `json:"content_hash"`
}

func prepareProposal(agentID, projectID, threadID, taskID string, items []ProposalItem) (Proposal, error) {
	if err := validChatKey(agentID, projectID); err != nil {
		return Proposal{}, err
	}
	if !validThread(threadID) || !validThread(taskID) {
		return Proposal{}, errors.New("提案的對話或工作編號不正確")
	}
	if len(items) == 0 {
		return Proposal{}, errors.New("提案至少要有一項成果")
	}
	id, err := newThreadID()
	if err != nil {
		return Proposal{}, err
	}
	proposal := Proposal{ID: id, TaskID: taskID, ThreadID: threadID, AgentID: agentID, ProjectID: projectID, Status: ProposalAwaitingConfirmation, CreatedAt: now(), Items: items}
	for index := range proposal.Items {
		item := &proposal.Items[index]
		item.ID, err = newThreadID()
		if err != nil {
			return Proposal{}, err
		}
		if err := normalizeProposalItem(item, projectID); err != nil {
			return Proposal{}, fmt.Errorf("提案項目 %d：%w", index+1, err)
		}
	}
	return proposal, nil
}

func normalizeProposalItem(item *ProposalItem, projectID string) error {
	targetKey := ""
	switch item.Kind {
	case ProposalKindStory, ProposalKindLore:
		targetKey = map[string]string{ProposalKindStory: "story_public_id", ProposalKindLore: "lore_public_id"}[item.Kind]
		if item.ContentType == "" {
			item.ContentType = "text"
		}
		if item.TargetID != "" && (item.BaseVersionID == "" || item.Base == nil) {
			return errors.New("更新既有內容時必須保存 base_version_id 與 base snapshot")
		}
	case ProposalKindAsset:
		if item.LocalPath == "" || item.MIMEType == "" {
			return errors.New("圖片資產提案缺少本機檔案或 MIME type")
		}
	default:
		return errors.New("不支援的提案類型")
	}
	if len(item.Operations) == 0 {
		return errors.New("缺少建議執行的 SteamLoom tool")
	}
	targetMatched := item.TargetID == ""
	for index := range item.Operations {
		operation := &item.Operations[index]
		if !strings.HasPrefix(operation.Tool, "storyteller_") || writerReadOnlyTool(operation.Tool) {
			return fmt.Errorf("tool %q 不是可審查的寫入操作", operation.Tool)
		}
		if operation.Arguments == nil {
			return fmt.Errorf("tool %q 缺少寫入參數", operation.Tool)
		}
		if target, ok := operation.Arguments["project_public_id"].(string); !ok || target != projectID {
			return fmt.Errorf("tool %q 的 project_public_id 與目前專案不一致", operation.Tool)
		}
		// Writer 核准的既有內容一律改成 fail-before-write；這個旗標會納入 proposal hash，
		// Agent 只能照作者看過的固定 arguments 呼叫，不能退回 last-write-wins。
		if item.TargetID != "" && writerConditionalTool(operation.Tool) {
			operation.Arguments["abort_on_conflict"] = true
		}
		arguments, err := canonicalArguments(operation.Arguments)
		if err != nil {
			return fmt.Errorf("tool %q 的參數無法序列化：%w", operation.Tool, err)
		}
		operation.Arguments = arguments
		if targetKey != "" {
			if target, exists := arguments[targetKey]; exists {
				if target != item.TargetID {
					return fmt.Errorf("tool %q 的 %s 與提案目標不一致", operation.Tool, targetKey)
				}
				targetMatched = true
			}
		}
		if content, exists := arguments["content"]; exists {
			if text, ok := content.(string); !ok || text != item.Content {
				return fmt.Errorf("tool %q 的 content 與 review 內容不一致", operation.Tool)
			}
		}
		if title, exists := arguments["title"]; exists && item.Title != "" {
			if text, ok := title.(string); !ok || text != item.Title {
				return fmt.Errorf("tool %q 的 title 與 review 標題不一致", operation.Tool)
			}
		}
		if item.TargetID != "" && writerConditionalTool(operation.Tool) {
			base, exists := arguments["base_version_id"]
			if !exists || fmt.Sprint(base) != item.BaseVersionID {
				return fmt.Errorf("tool %q 的 base_version_id 與提案基準不一致", operation.Tool)
			}
		}
	}
	if !targetMatched {
		return fmt.Errorf("operations 沒有指向提案目標 %q", item.TargetID)
	}
	return nil
}

func writerConditionalTool(name string) bool {
	return name == "storyteller_upsert_story" || name == "storyteller_upsert_lore"
}

func writerReadOnlyTool(name string) bool {
	for _, tool := range writerReadOnlyTools {
		if tool == name {
			return true
		}
	}
	return false
}

func canonicalArguments(input map[string]any) (map[string]any, error) {
	raw, err := json.Marshal(input)
	if err != nil {
		return nil, err
	}
	var output map[string]any
	decoder := json.NewDecoder(bytes.NewReader(raw))
	decoder.UseNumber()
	if err := decoder.Decode(&output); err != nil {
		return nil, err
	}
	return output, nil
}

func setProposalHashes(proposal *Proposal) error {
	for index := range proposal.Items {
		item := &proposal.Items[index]
		fingerprint := struct {
			Kind, TargetID, BaseVersionID, Title, Summary, ContentType, Content string
			Base                                                                *ProposalSnapshot
			Operations                                                          []ProposalOperation
			FileName, MIMEType, FileSHA256, AltText, CollectionID               string
		}{item.Kind, item.TargetID, item.BaseVersionID, item.Title, item.Summary, item.ContentType, item.Content, item.Base, item.Operations, item.FileName, item.MIMEType, item.FileSHA256, item.AltText, item.CollectionID}
		hash, err := hashJSON(fingerprint)
		if err != nil {
			return err
		}
		item.ContentHash = hash
	}
	hashes := make([]string, len(proposal.Items))
	for index, item := range proposal.Items {
		hashes[index] = item.ContentHash
	}
	hash, err := hashJSON(hashes)
	if err != nil {
		return err
	}
	proposal.ContentHash = hash
	return nil
}

func verifyProposalHashes(proposal Proposal) error {
	wantBatch := proposal.ContentHash
	wantItems := make([]string, len(proposal.Items))
	for index := range proposal.Items {
		wantItems[index] = proposal.Items[index].ContentHash
	}
	if err := setProposalHashes(&proposal); err != nil {
		return err
	}
	if proposal.ContentHash != wantBatch {
		return errors.New("提案內容已在確認前被修改")
	}
	for index := range proposal.Items {
		if proposal.Items[index].ContentHash != wantItems[index] {
			return errors.New("提案項目已在確認前被修改")
		}
	}
	return nil
}

func hashJSON(value any) (string, error) {
	raw, err := json.Marshal(value)
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(raw)
	return hex.EncodeToString(sum[:]), nil
}
