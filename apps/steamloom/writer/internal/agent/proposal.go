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
	ID              string         `json:"id"`
	TaskID          string         `json:"task_id"`
	ThreadID        string         `json:"thread_id"`
	AgentID         string         `json:"agent_id"`
	ProjectID       string         `json:"project_id"`
	Status          string         `json:"status"`
	ContentHash     string         `json:"content_hash"`
	CreatedAt       string         `json:"created_at"`
	DecidedAt       string         `json:"decided_at,omitempty"`
	AppliedAt       string         `json:"applied_at,omitempty"`
	InterruptedAt   string         `json:"interrupted_at,omitempty"`
	SelectedItemIDs []string       `json:"selected_item_ids,omitempty"`
	Items           []ProposalItem `json:"items"`
}

// ApplyItems 回傳作者核准的項目；舊版 proposal 沒有 selection 時維持整批套用相容性。
func (p Proposal) ApplyItems() []ProposalItem {
	if len(p.SelectedItemIDs) == 0 {
		return p.Items
	}
	selected := make(map[string]bool, len(p.SelectedItemIDs))
	for _, id := range p.SelectedItemIDs {
		selected[id] = true
	}
	items := make([]ProposalItem, 0, len(selected))
	for _, item := range p.Items {
		if selected[item.ID] {
			items = append(items, item)
		}
	}
	return items
}

// ProposalSnapshot 保存 Agent 產生提案時讀到的版本，供 review 時判斷 DB 是否已前進。
type ProposalSnapshot struct {
	Title       string `json:"title,omitempty"`
	Summary     string `json:"summary,omitempty"`
	ContentType string `json:"content_type,omitempty"`
	Content     string `json:"content,omitempty"`
}

// ProposalOperation 保存 Agent 建議的操作意圖供稽核；Writer 不會直接執行這些 tool arguments。
type ProposalOperation struct {
	Tool      string         `json:"tool"`
	Arguments map[string]any `json:"arguments"`
}

// ProposalItem 同時涵蓋故事、設定與圖片資產；真正套用只採用經 review 的正規化欄位。
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
		if (item.Kind == ProposalKindStory && strings.Contains(operation.Tool, "_lore")) || (item.Kind == ProposalKindLore && strings.Contains(operation.Tool, "_story")) {
			return fmt.Errorf("tool %q 與提案類型 %q 不一致", operation.Tool, item.Kind)
		}
		if operation.Arguments == nil {
			return fmt.Errorf("tool %q 缺少寫入參數", operation.Tool)
		}
		if target, ok := operation.Arguments["project_public_id"].(string); !ok || target != projectID {
			return fmt.Errorf("tool %q 的 project_public_id 與目前專案不一致", operation.Tool)
		}
		// operations 只供 review 與稽核；Writer 套用時不信任、也不執行這份 arguments。
		arguments, err := canonicalArguments(operation.Arguments)
		if err != nil {
			return fmt.Errorf("tool %q 的參數無法序列化：%w", operation.Tool, err)
		}
		operation.Arguments = arguments
		if item.TargetID != "" {
			if base, exists := arguments["base_version_id"]; exists && fmt.Sprint(base) != item.BaseVersionID {
				return fmt.Errorf("tool %q 的 base_version_id 與提案基準不一致", operation.Tool)
			}
		}
		if targetKey != "" {
			if target, exists := arguments[targetKey]; exists {
				if target != item.TargetID {
					return fmt.Errorf("tool %q 的 %s 與提案目標不一致", operation.Tool, targetKey)
				}
				targetMatched = true
			}
		}
	}
	if !targetMatched {
		return fmt.Errorf("operations 沒有指向提案目標 %q", item.TargetID)
	}
	return nil
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
