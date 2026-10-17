package agent

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"sort"
	"strconv"
	"strings"
)

// 與 SteamLoom asset upload API 同步，避免能 review 卻在 apply 時才被拒絕。
const maxProposalAssetSize = 15 << 20

var proposalAssetExtensions = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
	"image/gif":  ".gif",
}

// SaveProposal 將 Agent 回傳的成果搬進 Writer 管理的本機目錄，再追加 proposal.ready event。
func SaveProposal(agentID, projectID, threadID, taskID, assetRoot string, items []ProposalItem) (Proposal, error) {
	return saveProposal(agentID, projectID, threadID, taskID, assetRoot, Reply{}, items, "")
}

// SaveGeneratedProposal 保存 Worker 的本機產物，轉成第二階段 asset.upload 確認，不會直接上傳。
func SaveGeneratedProposal(agentID, projectID, threadID, taskID, assetRoot, workerName string, items []ProposalItem) (Proposal, error) {
	count := 0
	for _, item := range items {
		count += len(item.Artifacts)
	}
	return saveProposal(agentID, projectID, threadID, taskID, assetRoot, Reply{}, items, fmt.Sprintf("%s 已產生 %d 項媒體成果，等待確認上傳", workerName, count))
}

// saveTaskProposal 在提案驗證成功後才把摘要、completed 與 proposal.ready 一起落盤。
func saveTaskProposal(agentID, projectID, threadID, taskID, assetRoot string, reply Reply, items []ProposalItem) (Proposal, error) {
	return saveProposal(agentID, projectID, threadID, taskID, assetRoot, reply, items, "")
}

func saveProposal(agentID, projectID, threadID, taskID, assetRoot string, reply Reply, items []ProposalItem, readyText string) (Proposal, error) {
	chatMu.Lock()
	defer chatMu.Unlock()
	dir, idx, err := loadChat(agentID, projectID)
	if err != nil {
		return Proposal{}, err
	}
	thread, ok := threadByID(idx, threadID)
	if !ok {
		return Proposal{}, errors.New("找不到這段對話")
	}
	proposal, err := prepareProposal(agentID, projectID, threadID, taskID, items)
	if err != nil {
		return Proposal{}, err
	}
	root := filepath.Join(dir, "proposals", threadID)
	finalDir := filepath.Join(root, proposal.ID)
	stagingDir := finalDir + ".tmp"
	if err := os.MkdirAll(stagingDir, 0o700); err != nil {
		return Proposal{}, err
	}
	defer os.RemoveAll(stagingDir)
	for index := range proposal.Items {
		item := &proposal.Items[index]
		if item.Kind == ProposalKindAsset && len(item.Artifacts) == 0 {
			if err := stageProposalAsset(item, assetRoot, stagingDir, finalDir); err != nil {
				return Proposal{}, InvalidProposal(fmt.Errorf("提案項目 %d：%w", index+1, err))
			}
		}
		for artifactIndex := range item.Artifacts {
			artifact := &item.Artifacts[artifactIndex]
			if artifact.LocalPath == "" {
				continue
			}
			if err := stageProposalArtifact(artifact, assetRoot, stagingDir, finalDir); err != nil {
				return Proposal{}, InvalidProposal(fmt.Errorf("提案項目 %d 的 artifact %d：%w", index+1, artifactIndex+1, err))
			}
		}
	}
	if err := setProposalHashes(&proposal); err != nil {
		return Proposal{}, err
	}
	raw, err := json.MarshalIndent(proposal, "", "  ")
	if err != nil {
		return Proposal{}, err
	}
	if err := os.WriteFile(filepath.Join(stagingDir, "proposal.json"), append(raw, '\n'), 0o600); err != nil {
		return Proposal{}, err
	}
	if err := os.Rename(stagingDir, finalDir); err != nil {
		return Proposal{}, err
	}
	if readyText == "" {
		readyText = fmt.Sprintf("Agent 已提出 %d 項成果，等待確認", len(proposal.Items))
	}
	event := taskEvent(EventProposalReady, taskID, readyText)
	event.ProposalID = proposal.ID
	if readyText != "" {
		// Worker 細節只留在 append-only JSONL 供稽核，不在候選卡片暴露內部 ID。
		event.WorkerID, event.ProviderJobIDs, event.ProviderModels = generatedProposalAudit(proposal)
	}
	events := make([]ChatLine, 0, 3)
	if reply.Text != "" {
		events = append(events, messageEvent("assistant", reply.Text), taskEvent(EventTaskCompleted, taskID, "Agent 已完成工作"))
	}
	events = append(events, event)
	if err := appendLines(filepath.Join(dir, thread.ID+".jsonl"), events); err != nil {
		_ = os.RemoveAll(finalDir)
		return Proposal{}, err
	}
	if reply.SessionID != "" {
		thread.SessionID = reply.SessionID
	}
	thread.UpdatedAt = now()
	thread.LastTaskState = TaskAwaitingConfirmation
	thread.ActiveTaskID = ""
	idx.Threads = upsertFront(idx.Threads, thread)
	if err := saveIndex(dir, idx); err != nil {
		return Proposal{}, err
	}
	return proposal, nil
}

func generatedProposalAudit(proposal Proposal) (string, []string, []string) {
	workerIDs, jobIDs, models := map[string]bool{}, map[string]bool{}, map[string]bool{}
	for _, item := range proposal.Items {
		for _, artifact := range item.Artifacts {
			if artifact.ProviderID != "" {
				workerIDs[artifact.ProviderID] = true
			}
			if artifact.ProviderJobID != "" {
				jobIDs[artifact.ProviderJobID] = true
			}
			if artifact.Model != "" {
				models[artifact.Model] = true
			}
		}
	}
	workers := sortedKeys(workerIDs)
	return strings.Join(workers, ","), sortedKeys(jobIDs), sortedKeys(models)
}

func sortedKeys(values map[string]bool) []string {
	result := make([]string, 0, len(values))
	for value := range values {
		result = append(result, value)
	}
	sort.Strings(result)
	return result
}

// ConfigureMediaProposal 保存作者在動態表單確認過的輸入，並重算授權用 hash。
func ConfigureMediaProposal(agentID, projectID, threadID, proposalID, workerID string, inputs map[string]any) (Proposal, error) {
	chatMu.Lock()
	defer chatMu.Unlock()
	if !validThread(threadID) || !validThread(proposalID) {
		return Proposal{}, errors.New("找不到這批提案")
	}
	dir, idx, err := loadChat(agentID, projectID)
	if err != nil {
		return Proposal{}, err
	}
	if !hasThread(idx, threadID) {
		return Proposal{}, errors.New("找不到這段對話")
	}
	path := filepath.Join(dir, "proposals", threadID, proposalID, "proposal.json")
	proposal, err := readProposal(path)
	if err != nil {
		return Proposal{}, err
	}
	if proposal.Status != ProposalAwaitingConfirmation || !proposal.IsMediaBrief() {
		return Proposal{}, errors.New("這批提案不是可設定的媒體生成需求")
	}
	decisions, err := proposalDecisions(filepath.Join(dir, threadID+".jsonl"))
	if err != nil {
		return Proposal{}, err
	}
	if _, decided := decisions[proposalID]; decided {
		return Proposal{}, errors.New("這批提案已經完成決策")
	}
	proposal.Items[0].WorkerID, proposal.Items[0].JobInputs = workerID, inputs
	if err := setProposalHashes(&proposal); err != nil {
		return Proposal{}, err
	}
	if err := writeProposal(path, proposal); err != nil {
		return Proposal{}, err
	}
	return proposal, nil
}

// RetryMediaProposal 讓生成失敗的媒體提案換上新參數、回到 approved，再由 TaskManager 重新排入背景佇列。
// 沿用原本的核准事件：作者按「重新生成」本身就是對新參數的確認。
func RetryMediaProposal(agentID, projectID, threadID, proposalID, workerID string, inputs map[string]any) (Proposal, error) {
	chatMu.Lock()
	defer chatMu.Unlock()
	dir, _, _, proposal, path, err := loadProposalForApply(agentID, projectID, threadID, proposalID)
	if err != nil {
		return Proposal{}, err
	}
	lifecycle, found := proposalApplyLifecycle(filepath.Join(dir, threadID+".jsonl"), proposal.ID)
	if !proposal.IsMediaBrief() || proposal.Status != ProposalApplyFailed || !found || lifecycle.status != ProposalApplyFailed {
		return Proposal{}, errors.New("只有生成失敗的媒體需求可以重新生成")
	}
	proposal.Items[0].WorkerID, proposal.Items[0].JobInputs, proposal.Status, proposal.AppliedAt = workerID, inputs, ProposalApproved, ""
	if err := setProposalHashes(&proposal); err != nil {
		return Proposal{}, err
	}
	if err := writeProposal(path, proposal); err != nil {
		return Proposal{}, err
	}
	return proposal, nil
}

func stageProposalAsset(item *ProposalItem, assetRoot, stagingDir, finalDir string) error {
	artifact := ProposalArtifact{ID: item.ID, LocalPath: item.LocalPath, FileName: item.FileName, MIMEType: item.MIMEType, AltText: item.AltText}
	if err := stageProposalArtifact(&artifact, assetRoot, stagingDir, finalDir); err != nil {
		return err
	}
	item.LocalPath, item.FileName, item.MIMEType = artifact.LocalPath, artifact.FileName, artifact.MIMEType
	item.FileSize, item.FileSHA256 = artifact.FileSize, artifact.FileSHA256
	return nil
}

func stageProposalArtifact(artifact *ProposalArtifact, assetRoot, stagingDir, finalDir string) error {
	extension, ok := proposalAssetExtensions[artifact.MIMEType]
	if !ok {
		return errors.New("只接受 JPEG、PNG、WebP 或 GIF 圖片")
	}
	if !filepath.IsAbs(artifact.LocalPath) {
		return errors.New("圖片資產必須使用絕對路徑")
	}
	if assetRoot == "" || !pathInside(artifact.LocalPath, assetRoot) {
		return errors.New("圖片資產必須位於這條 Agent session 的工作目錄")
	}
	source, err := os.Open(artifact.LocalPath)
	if err != nil {
		return err
	}
	defer source.Close()
	info, err := source.Stat()
	if err != nil {
		return err
	}
	if !info.Mode().IsRegular() {
		return errors.New("圖片資產不是一般檔案")
	}
	artifactDir := filepath.Join(stagingDir, "artifacts")
	if err := os.MkdirAll(artifactDir, 0o700); err != nil {
		return err
	}
	name := artifact.ID + extension
	destination, err := os.OpenFile(filepath.Join(artifactDir, name), os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	hash := sha256.New()
	written, copyErr := io.Copy(io.MultiWriter(destination, hash), io.LimitReader(source, maxProposalAssetSize+1))
	closeErr := destination.Close()
	if copyErr != nil {
		return copyErr
	}
	if closeErr != nil {
		return closeErr
	}
	if written > maxProposalAssetSize {
		return errors.New("圖片資產超過 15 MiB")
	}
	artifact.FileSize = written
	artifact.FileSHA256 = hex.EncodeToString(hash.Sum(nil))
	artifact.LocalPath = filepath.Join(finalDir, "artifacts", name)
	if artifact.FileName == "" {
		artifact.FileName = filepath.Base(info.Name())
	}
	return nil
}

func pathInside(path, root string) bool {
	resolvedPath, err := filepath.EvalSymlinks(path)
	if err != nil {
		return false
	}
	resolvedRoot, err := filepath.EvalSymlinks(root)
	if err != nil {
		return false
	}
	relative, err := filepath.Rel(resolvedRoot, resolvedPath)
	return err == nil && relative != ".." && !filepath.IsAbs(relative) && !strings.HasPrefix(relative, ".."+string(filepath.Separator))
}

// Proposals 讀取一條 thread 的全部 proposal；payload 留在本機，不會查詢 SteamLoom。
func Proposals(agentID, projectID, threadID string) ([]Proposal, error) {
	chatMu.Lock()
	defer chatMu.Unlock()
	dir, idx, err := loadChat(agentID, projectID)
	if err != nil {
		return nil, err
	}
	if !validThread(threadID) || !hasThread(idx, threadID) {
		return nil, errors.New("找不到這段對話")
	}
	entries, err := os.ReadDir(filepath.Join(dir, "proposals", threadID))
	if errors.Is(err, os.ErrNotExist) {
		return []Proposal{}, nil
	}
	if err != nil {
		return nil, err
	}
	decisions, err := proposalDecisions(filepath.Join(dir, threadID+".jsonl"))
	if err != nil {
		return nil, err
	}
	proposals := make([]Proposal, 0, len(entries))
	for _, entry := range entries {
		if !entry.IsDir() || !validThread(entry.Name()) {
			continue
		}
		proposal, err := readProposal(filepath.Join(dir, "proposals", threadID, entry.Name(), "proposal.json"))
		if err != nil {
			return nil, err
		}
		if decision, exists := decisions[proposal.ID]; exists {
			proposal.Status, proposal.DecidedAt = decision.status, decision.at
		}
		if lifecycle, exists := proposalApplyLifecycle(filepath.Join(dir, threadID+".jsonl"), proposal.ID); exists {
			proposal.Status = lifecycle.status
			if lifecycle.status == ProposalVerificationRequired {
				proposal.InterruptedAt = lifecycle.at
			} else if lifecycle.at != "" {
				proposal.AppliedAt = lifecycle.at
			}
		}
		proposals = append(proposals, proposal)
	}
	sort.SliceStable(proposals, func(i, j int) bool { return proposals[i].CreatedAt < proposals[j].CreatedAt })
	return proposals, nil
}

// ProposalByID 讀取 Writer 本機 proposal，供確認前做 DB latest 檢查；不接觸 MCP。
func ProposalByID(agentID, projectID, threadID, proposalID string) (Proposal, error) {
	if !validThread(proposalID) {
		return Proposal{}, errors.New("找不到這批提案")
	}
	proposals, err := Proposals(agentID, projectID, threadID)
	if err != nil {
		return Proposal{}, err
	}
	for _, proposal := range proposals {
		if proposal.ID == proposalID {
			return proposal, nil
		}
	}
	return Proposal{}, errors.New("找不到這批提案")
}

type proposalDecision struct {
	status string
	at     string
	taskID string
}

func proposalDecisions(path string) (map[string]proposalDecision, error) {
	events, err := readLines(path)
	if err != nil {
		return nil, err
	}
	decisions := map[string]proposalDecision{}
	for _, event := range events {
		status := ""
		switch event.Type {
		case EventProposalApproved:
			status = ProposalApproved
		case EventProposalRejected:
			status = ProposalRejected
		}
		if status != "" && event.ProposalID != "" {
			decisions[event.ProposalID] = proposalDecision{status: status, at: event.CreatedAt}
		}
	}
	return decisions, nil
}

func proposalApplyLifecycle(path, proposalID string) (proposalDecision, bool) {
	events, err := readLines(path)
	if err != nil {
		return proposalDecision{}, false
	}
	state := proposalDecision{}
	found := false
	for _, event := range events {
		if event.ProposalID != proposalID {
			continue
		}
		switch event.Type {
		case EventApplyQueued:
			state, found = proposalDecision{status: ProposalApproved, taskID: event.TaskID}, true
		case EventApplyStarted:
			state, found = proposalDecision{status: ProposalApplying, taskID: event.TaskID}, true
		case EventApplyCompleted:
			state, found = proposalDecision{status: ProposalApplied, at: event.CreatedAt, taskID: event.TaskID}, true
		case EventApplyFailed:
			state, found = proposalDecision{status: ProposalApplyFailed, at: event.CreatedAt, taskID: event.TaskID}, true
		case EventApplyConflict:
			state, found = proposalDecision{status: ProposalConflict, at: event.CreatedAt, taskID: event.TaskID}, true
		case EventApplyInterrupted:
			state, found = proposalDecision{status: ProposalVerificationRequired, at: event.CreatedAt, taskID: event.TaskID}, true
		case EventApplyVerified:
			state, found = proposalDecision{status: ProposalApplied, at: event.CreatedAt, taskID: event.TaskID}, true
		}
	}
	return state, found
}

// DecideProposal 以 append-only event 作為決策事實來源；重複送出相同決策不會新增第二筆事件。
func DecideProposal(agentID, projectID, threadID, proposalID, decision string, selectedItemIDs ...[]string) (Proposal, error) {
	status, eventType := ProposalApproved, EventProposalApproved
	if decision == ProposalDecisionReject {
		status, eventType = ProposalRejected, EventProposalRejected
	} else if decision != ProposalDecisionApprove {
		return Proposal{}, errors.New("不支援的提案決策")
	}
	chatMu.Lock()
	defer chatMu.Unlock()
	if !validThread(threadID) || !validThread(proposalID) {
		return Proposal{}, errors.New("找不到這批提案")
	}
	dir, idx, err := loadChat(agentID, projectID)
	if err != nil {
		return Proposal{}, err
	}
	thread, ok := threadByID(idx, threadID)
	if !ok {
		return Proposal{}, errors.New("找不到這段對話")
	}
	path := filepath.Join(dir, "proposals", threadID, proposalID, "proposal.json")
	proposal, err := readProposal(path)
	if err != nil {
		return Proposal{}, err
	}
	if proposal.AgentID != agentID || proposal.ProjectID != projectID || proposal.ThreadID != threadID {
		return Proposal{}, errors.New("提案不屬於目前對話")
	}
	if err := verifyProposalHashes(proposal); err != nil {
		return Proposal{}, err
	}
	logPath := filepath.Join(dir, threadID+".jsonl")
	decisions, err := proposalDecisions(logPath)
	if err != nil {
		return Proposal{}, err
	}
	if previous, exists := decisions[proposalID]; exists {
		proposal.Status, proposal.DecidedAt = previous.status, previous.at
		if previous.status == status {
			if lifecycle, found := proposalApplyLifecycle(logPath, proposal.ID); found {
				proposal.Status, proposal.AppliedAt = lifecycle.status, lifecycle.at
			}
			return proposal, nil
		}
		return Proposal{}, errors.New("這批提案已經完成其他決策")
	}
	if proposal.Status != ProposalAwaitingConfirmation {
		return Proposal{}, errors.New("這批提案已經不在等待確認狀態")
	}
	if decision == ProposalDecisionApprove {
		proposal.SelectedItemIDs, proposal.SelectedArtifactIDs = nil, nil
		selected := map[string]bool{}
		if len(selectedItemIDs) == 0 {
			for _, item := range proposal.Items {
				itemSelected := len(item.Artifacts) == 0
				for _, artifact := range item.Artifacts {
					if artifact.DefaultSelected {
						selected[artifact.ID], itemSelected = true, true
					}
				}
				if itemSelected {
					selected[item.ID] = true
				}
			}
		} else {
			for _, id := range selectedItemIDs[0] {
				selected[id] = true
			}
		}
		for _, item := range proposal.Items {
			if selected[item.ID] {
				proposal.SelectedItemIDs = append(proposal.SelectedItemIDs, item.ID)
				delete(selected, item.ID)
				selectedForItem := 0
				for _, artifact := range item.Artifacts {
					if selected[artifact.ID] {
						proposal.SelectedArtifactIDs = append(proposal.SelectedArtifactIDs, artifact.ID)
						delete(selected, artifact.ID)
						selectedForItem++
					}
				}
				if len(item.Artifacts) > 0 && selectedForItem == 0 {
					return Proposal{}, fmt.Errorf("%s 至少要選擇一份媒體成果", item.Title)
				}
			}
		}
		if len(proposal.SelectedItemIDs) == 0 {
			return Proposal{}, errors.New("至少要選擇一項成果才能套用")
		}
		if len(selected) > 0 {
			return Proposal{}, errors.New("核准清單包含不屬於這批提案的項目")
		}
		proposalDir := filepath.Dir(path)
		for _, item := range proposal.ApplyItems() {
			if item.Kind == ProposalKindAsset && len(item.Artifacts) == 0 {
				if _, err := readVerifiedProposalAsset(item, proposalDir); err != nil {
					return Proposal{}, err
				}
			}
			for _, artifact := range item.Artifacts {
				if artifact.LocalPath == "" {
					continue
				}
				if _, err := readVerifiedProposalArtifact(artifact, proposalDir); err != nil {
					return Proposal{}, err
				}
			}
		}
		// 先保存 selection，再追加決策 event；即使 event 寫入失敗，重試也不會退回整批套用。
		if err := writeProposal(path, proposal); err != nil {
			return Proposal{}, err
		}
	}
	text := proposalDecisionText(proposal, decision)
	event := taskEvent(eventType, proposal.TaskID, text)
	event.ProposalID, event.ContentHash = proposal.ID, proposal.ContentHash
	if err := appendLines(logPath, []ChatLine{event}); err != nil {
		return Proposal{}, err
	}
	proposal.Status, proposal.DecidedAt = status, event.CreatedAt
	if err := writeProposal(path, proposal); err != nil {
		return Proposal{}, err
	}
	thread.UpdatedAt, thread.LastTaskState, thread.ActiveTaskID = now(), status, ""
	idx.Threads = upsertFront(idx.Threads, thread)
	if err := saveIndex(dir, idx); err != nil {
		return Proposal{}, err
	}
	return proposal, nil
}

func proposalDecisionText(proposal Proposal, decision string) string {
	proposalItems := proposal.Items
	if decision == ProposalDecisionApprove {
		proposalItems = proposal.ApplyItems()
	}
	items := make([]string, 0, len(proposalItems))
	for _, item := range proposalItems {
		kind := map[string]string{ProposalKindStory: "故事", ProposalKindLore: "設定", ProposalKindAsset: "圖片", ProposalKindMedia: "媒體生成"}[item.Kind]
		title := strings.TrimSpace(item.Title)
		if title == "" {
			title = strings.TrimSpace(item.FileName)
		}
		if title != "" {
			items = append(items, fmt.Sprintf("%s〈%s〉", kind, title))
		} else {
			items = append(items, kind)
		}
	}
	action := "已核准套用"
	if decision == ProposalDecisionReject {
		action = "已否決"
	} else if proposal.IsMediaBrief() {
		action = "已核准執行"
	}
	return decisionStatusText(action, len(items), strings.Join(items, "、"))
}

// decisionStatusText 把決策寫成狀態句（不是作者的發言）；多項時才標數量。
func decisionStatusText(action string, count int, items string) string {
	if count > 1 {
		return fmt.Sprintf("%s %d 項：%s", action, count, items)
	}
	return action + "：" + items
}

// legacyDecision 對應舊版「你已同意套用 1 項變更：…」這類以作者口吻寫進紀錄的決策文字。
var legacyDecision = regexp.MustCompile(`^你已(同意套用|同意執行|否決) (\d+) 項變更：(.*)$`)

// statusDecisionText 在讀取時把舊紀錄轉成狀態句，不改寫 append-only 的 jsonl。
func statusDecisionText(text string) string {
	if match := legacyDecision.FindStringSubmatch(text); match != nil {
		count, _ := strconv.Atoi(match[2])
		action := map[string]string{"同意套用": "已核准套用", "同意執行": "已核准執行", "否決": "已否決"}[match[1]]
		return decisionStatusText(action, count, match[3])
	}
	// 其他舊句型（例如「你已確認內容成功套用」）只拿掉「你」，保留「已…」
	if strings.HasPrefix(text, "你已") {
		return strings.TrimPrefix(text, "你")
	}
	return text
}

func writeProposal(path string, proposal Proposal) error {
	raw, err := json.MarshalIndent(proposal, "", "  ")
	if err != nil {
		return err
	}
	temporary := path + ".tmp"
	if err := os.WriteFile(temporary, append(raw, '\n'), 0o600); err != nil {
		return err
	}
	if err := os.Rename(temporary, path); err != nil {
		_ = os.Remove(temporary)
		return err
	}
	return nil
}

func readProposal(path string) (Proposal, error) {
	raw, err := os.ReadFile(path)
	if err != nil {
		return Proposal{}, err
	}
	var proposal Proposal
	if err := json.Unmarshal(raw, &proposal); err != nil {
		return Proposal{}, err
	}
	return proposal, nil
}
