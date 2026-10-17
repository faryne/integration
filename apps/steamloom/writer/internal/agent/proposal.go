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
	ProposalKindMedia            = "media"
	ProposalTypeDocumentCreate   = "document.create"
	ProposalTypeDocumentReplace  = "document.replace"
	ProposalTypeDocumentPatch    = "document.patch"
	ProposalTypeChapterAppend    = "chapter.append"
	ProposalTypeChapterReplace   = "chapter.replace"
	ProposalTypeAssetUpload      = "asset.upload"
	ProposalTypeMediaBrief       = "media.brief"
	ProposalTypeImageStoryCreate = "image_story.create"
	ProposalTypeImageStoryUpdate = "image_story.update"
)

// Proposal 是單一 task 交付的一批成果；使用者之後預設整批審查，但授權仍逐 item 綁定 hash。
type Proposal struct {
	ID                  string         `json:"id"`
	TaskID              string         `json:"task_id"`
	ThreadID            string         `json:"thread_id"`
	AgentID             string         `json:"agent_id"`
	ProjectID           string         `json:"project_id"`
	Status              string         `json:"status"`
	ContentHash         string         `json:"content_hash"`
	CreatedAt           string         `json:"created_at"`
	DecidedAt           string         `json:"decided_at,omitempty"`
	AppliedAt           string         `json:"applied_at,omitempty"`
	InterruptedAt       string         `json:"interrupted_at,omitempty"`
	SelectedItemIDs     []string       `json:"selected_item_ids,omitempty"`
	SelectedArtifactIDs []string       `json:"selected_artifact_ids,omitempty"`
	Items               []ProposalItem `json:"items"`
}

// IsMediaBrief 判斷是否為單項媒體生成需求；這類提案在背景佇列執行，失敗後可調整參數重跑。
func (p Proposal) IsMediaBrief() bool {
	return len(p.Items) == 1 && p.Items[0].ProposalType == ProposalTypeMediaBrief
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
	selectedArtifacts := make(map[string]bool, len(p.SelectedArtifactIDs))
	for _, id := range p.SelectedArtifactIDs {
		selectedArtifacts[id] = true
	}
	items := make([]ProposalItem, 0, len(selected))
	for _, item := range p.Items {
		if selected[item.ID] {
			if len(selectedArtifacts) > 0 && len(item.Artifacts) > 0 {
				artifacts := make([]ProposalArtifact, 0, len(item.Artifacts))
				for _, artifact := range item.Artifacts {
					if selectedArtifacts[artifact.ID] {
						artifacts = append(artifacts, artifact)
					}
				}
				item.Artifacts = artifacts
			}
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

// ProposalEdit 是 document.patch 的一筆搜尋取代；Writer 依序套在 base 版本上算出全文，Agent 不必重送整份內容。
// All 為 false 時 Find 必須剛好出現一次，避免改到作者沒看到的同名段落。
type ProposalEdit struct {
	Find    string `json:"find"`
	Replace string `json:"replace"`
	All     bool   `json:"all,omitempty"`
}

// MediaBrief 是 Agent 對 Worker 的標準化創作意圖；真正的動態參數由 Writer 表單收集。
type MediaBrief struct {
	Prompt         string `json:"prompt"`
	NegativePrompt string `json:"negative_prompt,omitempty"`
	AspectRatio    string `json:"aspect_ratio,omitempty"`
	CandidateCount int    `json:"candidate_count,omitempty"`
	Notes          string `json:"notes,omitempty"`
}

// maxProposalEdits 限制單一 patch 的筆數；超過代表應改用 document.replace 或拆成多輪。
const maxProposalEdits = 200

// ProposalArtifact 是 provider 產生或既已存在於 SteamLoom 的媒體成果。
// LocalPath 會在 proposal 落盤前搬到 Writer staging；AssetPublicID 則代表沿用既有資產。
type ProposalArtifact struct {
	ID              string         `json:"id"`
	ProviderID      string         `json:"provider_id,omitempty"`
	ProviderJobID   string         `json:"provider_job_id,omitempty"`
	Model           string         `json:"model,omitempty"`
	Parameters      map[string]any `json:"parameters,omitempty"`
	CandidateGroup  string         `json:"candidate_group,omitempty"`
	DefaultSelected bool           `json:"default_selected"`
	LocalPath       string         `json:"local_path,omitempty"`
	AssetPublicID   string         `json:"asset_public_id,omitempty"`
	FileName        string         `json:"file_name,omitempty"`
	MIMEType        string         `json:"mime_type,omitempty"`
	FileSize        int64          `json:"file_size,omitempty"`
	FileSHA256      string         `json:"file_sha256,omitempty"`
	AltText         string         `json:"alt_text,omitempty"`
	Description     string         `json:"description,omitempty"`
	Width           int            `json:"width,omitempty"`
	Height          int            `json:"height,omitempty"`
	DurationMS      int64          `json:"duration_ms,omitempty"`
	PageID          string         `json:"page_id,omitempty"`
	Sort            int            `json:"sort"`
}

// ProposalItem 同時涵蓋故事、設定與圖片資產；真正套用只採用經 review 的正規化欄位。
type ProposalItem struct {
	ID            string              `json:"id"`
	ProposalType  string              `json:"proposal_type,omitempty"`
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
	MarkerID      string              `json:"marker_id,omitempty"`
	AfterMarkerID string              `json:"after_marker_id,omitempty"`
	WorkerID      string              `json:"worker_id,omitempty"`
	Brief         *MediaBrief         `json:"brief,omitempty"`
	JobInputs     map[string]any      `json:"job_inputs,omitempty"`
	Artifacts     []ProposalArtifact  `json:"artifacts,omitempty"`
	Edits         []ProposalEdit      `json:"edits,omitempty"`
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
		for artifactIndex := range item.Artifacts {
			if item.Artifacts[artifactIndex].ProviderID == "" {
				item.Artifacts[artifactIndex].ProviderID = agentID
			}
		}
		item.ID, err = newThreadID()
		if err != nil {
			return Proposal{}, err
		}
		if err := normalizeProposalItem(item, projectID); err != nil {
			return Proposal{}, InvalidProposal(fmt.Errorf("提案項目 %d：%w", index+1, err))
		}
	}
	return proposal, nil
}

func normalizeProposalItem(item *ProposalItem, projectID string) error {
	if item.ProposalType == "" {
		item.ProposalType = inferLegacyProposalType(*item)
	}
	targetKey := ""
	switch item.ProposalType {
	case ProposalTypeDocumentCreate:
		if item.Kind != ProposalKindStory && item.Kind != ProposalKindLore {
			return errors.New("新增全文只支援故事或設定")
		}
		if item.TargetID != "" {
			return errors.New("新增全文不能指定既有目標")
		}
		if item.ContentType == "" {
			item.ContentType = "text"
		}
	case ProposalTypeDocumentReplace, ProposalTypeDocumentPatch, ProposalTypeChapterAppend, ProposalTypeChapterReplace:
		if item.Kind != ProposalKindStory && item.Kind != ProposalKindLore {
			return errors.New("文件與章節提案只支援故事或設定")
		}
		targetKey = map[string]string{ProposalKindStory: "story_public_id", ProposalKindLore: "lore_public_id"}[item.Kind]
		if item.ContentType == "" {
			item.ContentType = "text"
		}
		if item.TargetID == "" {
			return errors.New("修改既有內容時必須指定 target_id")
		}
		if item.BaseVersionID == "" || item.Base == nil {
			return errors.New("更新既有內容時必須保存 base_version_id 與 base snapshot")
		}
		if item.ProposalType == ProposalTypeChapterReplace && item.MarkerID == "" {
			return errors.New("替換章節時必須指定 marker_id")
		}
	case ProposalTypeAssetUpload:
		item.Kind = ProposalKindAsset
		if len(item.Artifacts) == 0 && (item.LocalPath == "" || item.MIMEType == "") {
			return errors.New("圖片資產提案缺少本機檔案或 MIME type")
		}
	case ProposalTypeMediaBrief:
		item.Kind = ProposalKindMedia
		if item.WorkerID == "" {
			return errors.New("媒體生成需求缺少 worker_id")
		}
		if item.Brief == nil || strings.TrimSpace(item.Brief.Prompt) == "" {
			return errors.New("媒體生成需求缺少 brief.prompt")
		}
		if item.Title == "" {
			item.Title = "未命名媒體"
		}
	case ProposalTypeImageStoryCreate, ProposalTypeImageStoryUpdate:
		item.Kind, item.ContentType = ProposalKindStory, "image"
		if len(item.Artifacts) == 0 {
			return errors.New("圖像作品提案至少需要一頁")
		}
		if item.ProposalType == ProposalTypeImageStoryCreate && item.TargetID != "" {
			return errors.New("新增圖像作品不能指定既有目標")
		}
		if item.ProposalType == ProposalTypeImageStoryUpdate {
			targetKey = "story_public_id"
			if item.TargetID == "" || item.BaseVersionID == "" || item.Base == nil {
				return errors.New("更新圖像作品時必須保存 target_id、base_version_id 與 base snapshot")
			}
		}
	default:
		return errors.New("不支援的提案類型")
	}
	if err := validateProposalEdits(item); err != nil {
		return err
	}
	for index := range item.Artifacts {
		artifact := &item.Artifacts[index]
		if artifact.ID == "" {
			id, err := newThreadID()
			if err != nil {
				return err
			}
			artifact.ID = id
		}
		if artifact.LocalPath == "" && artifact.AssetPublicID == "" {
			return fmt.Errorf("artifact %d 缺少本機檔案或既有資產", index+1)
		}
		if item.ProposalType == ProposalTypeAssetUpload && artifact.LocalPath == "" {
			return fmt.Errorf("artifact %d 不是可上傳的本機檔案", index+1)
		}
		artifact.Sort = index
	}
	// V2 proposal 直接以正規化欄位描述變更，operations 僅保留舊版稽核資訊。
	targetMatched := item.TargetID == "" || len(item.Operations) == 0
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

// validateProposalEdits 確保只有 document.patch 帶 edits，且每筆都能定位；實際比對在 Writer 建立基準時進行。
func validateProposalEdits(item *ProposalItem) error {
	if item.ProposalType != ProposalTypeDocumentPatch {
		if len(item.Edits) > 0 {
			return errors.New("只有 document.patch 可以附 edits")
		}
		return nil
	}
	if len(item.Edits) == 0 {
		return errors.New("document.patch 至少要有一筆 edits")
	}
	if len(item.Edits) > maxProposalEdits {
		return fmt.Errorf("document.patch 最多 %d 筆 edits，請改用 document.replace", maxProposalEdits)
	}
	for index, edit := range item.Edits {
		if edit.Find == "" {
			return fmt.Errorf("edits 第 %d 筆的 find 不可為空", index+1)
		}
	}
	return nil
}

func inferLegacyProposalType(item ProposalItem) string {
	if item.Kind == ProposalKindAsset {
		return ProposalTypeAssetUpload
	}
	if item.TargetID == "" {
		return ProposalTypeDocumentCreate
	}
	return ProposalTypeDocumentReplace
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
			ProposalType, Kind, TargetID, BaseVersionID, Title, Summary, ContentType, Content, MarkerID, AfterMarkerID string
			Base                                                                                                       *ProposalSnapshot
			Operations                                                                                                 []ProposalOperation
			FileName, MIMEType, FileSHA256, AltText, CollectionID                                                      string
			Artifacts                                                                                                  []ProposalArtifact
			// omitempty 讓沒有 edits 的既有提案 hash 維持不變。
			Edits     []ProposalEdit `json:",omitempty"`
			WorkerID  string         `json:",omitempty"`
			Brief     *MediaBrief    `json:",omitempty"`
			JobInputs map[string]any `json:",omitempty"`
		}{item.ProposalType, item.Kind, item.TargetID, item.BaseVersionID, item.Title, item.Summary, item.ContentType, item.Content, item.MarkerID, item.AfterMarkerID, item.Base, item.Operations, item.FileName, item.MIMEType, item.FileSHA256, item.AltText, item.CollectionID, item.Artifacts, item.Edits, item.WorkerID, item.Brief, item.JobInputs}
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
