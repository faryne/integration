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
	"sort"
	"strings"
)

const maxProposalAssetSize = 100 << 20

var proposalAssetExtensions = map[string]string{
	"image/jpeg": ".jpg",
	"image/png":  ".png",
	"image/webp": ".webp",
	"image/gif":  ".gif",
}

// SaveProposal 將 Agent 回傳的成果搬進 Writer 管理的本機目錄，再追加 proposal.ready event。
func SaveProposal(agentID, projectID, threadID, taskID, assetRoot string, items []ProposalItem) (Proposal, error) {
	return saveProposal(agentID, projectID, threadID, taskID, assetRoot, Reply{}, items)
}

// saveTaskProposal 在提案驗證成功後才把摘要、completed 與 proposal.ready 一起落盤。
func saveTaskProposal(agentID, projectID, threadID, taskID, assetRoot string, reply Reply, items []ProposalItem) (Proposal, error) {
	return saveProposal(agentID, projectID, threadID, taskID, assetRoot, reply, items)
}

func saveProposal(agentID, projectID, threadID, taskID, assetRoot string, reply Reply, items []ProposalItem) (Proposal, error) {
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
		if proposal.Items[index].Kind != ProposalKindAsset {
			continue
		}
		if err := stageProposalAsset(&proposal.Items[index], assetRoot, stagingDir, finalDir); err != nil {
			return Proposal{}, fmt.Errorf("提案項目 %d：%w", index+1, err)
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
	event := taskEvent(EventProposalReady, taskID, fmt.Sprintf("Agent 已提出 %d 項成果，等待確認", len(proposal.Items)))
	event.ProposalID = proposal.ID
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

func stageProposalAsset(item *ProposalItem, assetRoot, stagingDir, finalDir string) error {
	extension, ok := proposalAssetExtensions[item.MIMEType]
	if !ok {
		return errors.New("只接受 JPEG、PNG、WebP 或 GIF 圖片")
	}
	if !filepath.IsAbs(item.LocalPath) {
		return errors.New("圖片資產必須使用絕對路徑")
	}
	if assetRoot == "" || !pathInside(item.LocalPath, assetRoot) {
		return errors.New("圖片資產必須位於這條 Agent session 的工作目錄")
	}
	source, err := os.Open(item.LocalPath)
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
	name := item.ID + extension
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
		return errors.New("圖片資產超過 100 MiB")
	}
	item.FileSize = written
	item.FileSHA256 = hex.EncodeToString(hash.Sum(nil))
	item.LocalPath = filepath.Join(finalDir, "artifacts", name)
	if item.FileName == "" {
		item.FileName = filepath.Base(info.Name())
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
		proposal.SelectedItemIDs = nil
		selected := map[string]bool{}
		if len(selectedItemIDs) == 0 {
			for _, item := range proposal.Items {
				selected[item.ID] = true
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
			if item.Kind == ProposalKindAsset {
				if _, err := readVerifiedProposalAsset(item, proposalDir); err != nil {
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
		kind := map[string]string{ProposalKindStory: "故事", ProposalKindLore: "設定", ProposalKindAsset: "圖片"}[item.Kind]
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
	action := "同意套用"
	if decision == ProposalDecisionReject {
		action = "否決"
	}
	return fmt.Sprintf("你已%s %d 項變更：%s", action, len(items), strings.Join(items, "、"))
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
