package agent

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

func recordApplyQueued(agentID, projectID, threadID, proposalID, taskID string) (Proposal, error) {
	chatMu.Lock()
	defer chatMu.Unlock()
	dir, idx, thread, proposal, _, err := loadProposalForApply(agentID, projectID, threadID, proposalID)
	if err != nil {
		return Proposal{}, err
	}
	if proposal.Status != ProposalApproved {
		return Proposal{}, errors.New("這批提案尚未取得作者允許")
	}
	event := taskEvent(EventApplyQueued, taskID, "等待 Writer 套用核准的提案")
	event.ProposalID, event.ContentHash = proposal.ID, proposal.ContentHash
	if err := appendLines(filepath.Join(dir, threadID+".jsonl"), []ChatLine{event}); err != nil {
		return Proposal{}, err
	}
	thread.UpdatedAt = event.CreatedAt
	claimThread(&thread, taskID, TaskQueued)
	idx.Threads = upsertFront(idx.Threads, thread)
	if err := saveIndex(dir, idx); err != nil {
		return Proposal{}, err
	}
	return proposal, nil
}

func recordApplyStarted(agentID, projectID, threadID, proposalID, taskID string) (Proposal, error) {
	chatMu.Lock()
	defer chatMu.Unlock()
	dir, idx, thread, proposal, path, err := loadProposalForApply(agentID, projectID, threadID, proposalID)
	if err != nil {
		return Proposal{}, err
	}
	decisions, err := proposalDecisions(filepath.Join(dir, threadID+".jsonl"))
	if err != nil {
		return Proposal{}, err
	}
	if decision, exists := decisions[proposal.ID]; !exists || decision.status != ProposalApproved {
		return Proposal{}, errors.New("這批提案尚未取得作者允許")
	}
	if proposal.Status != ProposalApproved {
		return Proposal{}, errors.New("這批提案已經開始或完成執行")
	}
	event := taskEvent(EventApplyStarted, taskID, "Writer 已開始套用核准的提案")
	event.ProposalID, event.ContentHash = proposal.ID, proposal.ContentHash
	if err := appendLines(filepath.Join(dir, threadID+".jsonl"), []ChatLine{event}); err != nil {
		return Proposal{}, err
	}
	proposal.Status = ProposalApplying
	if err := writeProposal(path, proposal); err != nil {
		return Proposal{}, err
	}
	thread.UpdatedAt = now()
	claimThread(&thread, taskID, TaskApplying)
	idx.Threads = upsertFront(idx.Threads, thread)
	if err := saveIndex(dir, idx); err != nil {
		return Proposal{}, err
	}
	return proposal, nil
}

func recordApplyCompleted(agentID, projectID, threadID, proposalID, taskID, reply string) (Proposal, error) {
	return recordApplyOutcome(agentID, projectID, threadID, proposalID, taskID, ProposalApplied, TaskApplied, EventApplyCompleted, "Writer 已完成提案套用", reply)
}

func recordApplyItem(agentID, projectID, threadID, proposalID, taskID, itemID, eventType, detail string) (Proposal, error) {
	chatMu.Lock()
	defer chatMu.Unlock()
	dir, idx, thread, proposal, _, err := loadProposalForApply(agentID, projectID, threadID, proposalID)
	if err != nil {
		return Proposal{}, err
	}
	if proposal.Status != ProposalApplying {
		return Proposal{}, fmt.Errorf("提案目前是 %s，不能保存單項套用結果", proposal.Status)
	}
	var item ProposalItem
	for _, candidate := range proposal.ApplyItems() {
		if candidate.ID == itemID {
			item = candidate
			break
		}
	}
	if item.ID == "" {
		return Proposal{}, errors.New("套用項目不屬於這批已核准提案")
	}
	text := ProposalItemApplyLabel(item)
	switch eventType {
	case EventApplyItemStarted:
		text += "……開始"
	case EventApplyItemDone:
		text += "……完成"
	case EventApplyItemFailed:
		text += "……失敗"
		if detail != "" {
			text += "：" + detail
		}
	default:
		return Proposal{}, errors.New("不支援的單項套用事件")
	}
	event := taskEvent(eventType, taskID, text)
	event.ProposalID, event.ItemID, event.ContentHash = proposal.ID, item.ID, item.ContentHash
	if err := appendLines(filepath.Join(dir, threadID+".jsonl"), []ChatLine{event}); err != nil {
		return Proposal{}, err
	}
	thread.UpdatedAt = event.CreatedAt
	idx.Threads = upsertFront(idx.Threads, thread)
	if err := saveIndex(dir, idx); err != nil {
		return Proposal{}, err
	}
	return proposal, nil
}

// ProposalItemApplyLabel 回傳對作者可讀的具體操作，不把內部 event type 當 UI 文案。
func ProposalItemApplyLabel(item ProposalItem) string {
	action := map[string]string{
		ProposalTypeDocumentCreate:   "新增內容",
		ProposalTypeDocumentReplace:  "更新內容",
		ProposalTypeDocumentPatch:    "修改內容",
		ProposalTypeChapterAppend:    "新增章節",
		ProposalTypeChapterReplace:   "更新章節",
		ProposalTypeAssetUpload:      "上傳圖片",
		ProposalTypeMediaBrief:       "生成媒體",
		ProposalTypeImageStoryCreate: "新增圖像作品",
		ProposalTypeImageStoryUpdate: "更新圖像作品",
	}[item.ProposalType]
	if verb := map[string]string{ProposalTypeDocumentCreate: "新增", ProposalTypeDocumentReplace: "更新", ProposalTypeDocumentPatch: "修改"}[item.ProposalType]; verb != "" {
		action = verb + map[string]string{ProposalKindStory: "故事", ProposalKindLore: "設定"}[item.Kind]
	}
	title := item.Title
	if item.ProposalType == ProposalTypeChapterAppend || item.ProposalType == ProposalTypeChapterReplace {
		title = proposalChapterTitle(item.Content)
	}
	if title == "" {
		title = item.FileName
	}
	if title == "" {
		return action
	}
	return fmt.Sprintf("%s「%s」", action, title)
}

func proposalChapterTitle(content string) string {
	line := strings.TrimSpace(strings.SplitN(content, "\n", 2)[0])
	line = strings.TrimSpace(strings.TrimLeft(line, "#"))
	if strings.HasPrefix(line, "⟦") {
		if end := strings.Index(line, "⟧"); end >= 0 {
			line = line[end+len("⟧"):]
		}
	}
	if end := strings.LastIndex(line, "⟦/"); end >= 0 {
		line = line[:end]
	}
	return strings.TrimSpace(line)
}

func recordApplyFailed(agentID, projectID, threadID, proposalID, taskID, detail, partial string) (Proposal, error) {
	text := "Writer 套用提案失敗"
	if detail != "" {
		text += "：" + detail
	}
	return recordApplyOutcome(agentID, projectID, threadID, proposalID, taskID, ProposalApplyFailed, TaskFailed, EventApplyFailed, text, partial)
}

func recordApplyConflict(agentID, projectID, threadID, proposalID, taskID, detail, partial string) (Proposal, error) {
	text := "資料已在確認後變更，Writer 未覆寫新版本"
	if detail != "" {
		text += "：" + detail
	}
	return recordApplyOutcome(agentID, projectID, threadID, proposalID, taskID, ProposalConflict, TaskConflict, EventApplyConflict, text, partial)
}

// ConfirmProposalApplied 只在作者已自行確認 REST 寫入成功時修正本機狀態；不會再次送出 mutation。
func ConfirmProposalApplied(agentID, projectID, threadID, proposalID string) (Proposal, error) {
	chatMu.Lock()
	defer chatMu.Unlock()
	dir, idx, thread, proposal, path, err := loadProposalForApply(agentID, projectID, threadID, proposalID)
	if err != nil {
		return Proposal{}, err
	}
	lifecycle, found := proposalApplyLifecycle(filepath.Join(dir, threadID+".jsonl"), proposal.ID)
	if proposal.Status == ProposalApplied && found && lifecycle.status == ProposalApplied {
		return proposal, nil
	}
	if proposal.Status != ProposalVerificationRequired || !found || lifecycle.status != ProposalVerificationRequired {
		return Proposal{}, errors.New("這批提案目前不需要確認套用結果")
	}
	event := taskEvent(EventApplyVerified, lifecycle.taskID, "已確認內容成功套用；Writer 沒有再次送出寫入請求")
	event.ProposalID, event.ContentHash = proposal.ID, proposal.ContentHash
	if err := appendLines(filepath.Join(dir, threadID+".jsonl"), []ChatLine{event}); err != nil {
		return Proposal{}, err
	}
	proposal.Status, proposal.AppliedAt = ProposalApplied, event.CreatedAt
	if err := writeProposal(path, proposal); err != nil {
		return Proposal{}, err
	}
	thread.UpdatedAt, thread.LastTaskState, thread.ActiveTaskID = event.CreatedAt, TaskApplied, ""
	idx.Threads = upsertFront(idx.Threads, thread)
	if err := saveIndex(dir, idx); err != nil {
		return Proposal{}, err
	}
	return proposal, nil
}

func recordApplyOutcome(agentID, projectID, threadID, proposalID, taskID, proposalState, taskState, eventType, eventText, reply string) (Proposal, error) {
	chatMu.Lock()
	defer chatMu.Unlock()
	dir, idx, thread, proposal, path, err := loadProposalForApply(agentID, projectID, threadID, proposalID)
	if err != nil {
		return Proposal{}, err
	}
	lateCompletion := false
	if eventType == EventApplyCompleted && proposal.Status == ProposalVerificationRequired {
		lifecycle, found := proposalApplyLifecycle(filepath.Join(dir, threadID+".jsonl"), proposal.ID)
		lateCompletion = found && lifecycle.status == ProposalVerificationRequired && lifecycle.taskID == taskID
	}
	if proposal.Status != ProposalApplying && !(proposalState == ProposalApplyFailed && proposal.Status == ProposalApproved) && !lateCompletion {
		return Proposal{}, fmt.Errorf("提案目前是 %s，不能完成這次 apply", proposal.Status)
	}
	if eventType == EventApplyCompleted && reply != "" {
		eventText = reply
	}
	event := taskEvent(eventType, taskID, eventText)
	event.ProposalID, event.ContentHash = proposal.ID, proposal.ContentHash
	if err := appendLines(filepath.Join(dir, threadID+".jsonl"), []ChatLine{event}); err != nil {
		return Proposal{}, err
	}
	proposal.Status = proposalState
	if proposalState == ProposalVerificationRequired {
		proposal.InterruptedAt = event.CreatedAt
	} else {
		proposal.AppliedAt = event.CreatedAt
	}
	if err := writeProposal(path, proposal); err != nil {
		return Proposal{}, err
	}
	thread.UpdatedAt = now()
	if releaseThread(&thread, taskID, taskState) && eventType == EventApplyCompleted && hasAwaitingProposal(dir, threadID, proposalID) {
		thread.LastTaskState = TaskAwaitingConfirmation
	}
	idx.Threads = upsertFront(idx.Threads, thread)
	if err := saveIndex(dir, idx); err != nil {
		return Proposal{}, err
	}
	return proposal, nil
}

// claimThread 只在 thread 沒有其他進行中工作時登記；背景媒體生成會和對話 task 同時跑，不能互相覆寫。
func claimThread(thread *Thread, taskID, state string) {
	if thread.ActiveTaskID == "" || thread.ActiveTaskID == taskID {
		thread.LastTaskState, thread.ActiveTaskID = state, taskID
	}
}

// releaseThread 只釋放自己登記的 ActiveTaskID；thread 正被另一個 task 使用時回傳 false、不動狀態。
func releaseThread(thread *Thread, taskID, state string) bool {
	if thread.ActiveTaskID != "" && thread.ActiveTaskID != taskID {
		return false
	}
	thread.LastTaskState, thread.ActiveTaskID = state, ""
	return true
}

func hasAwaitingProposal(dir, threadID, excludeID string) bool {
	entries, err := os.ReadDir(filepath.Join(dir, "proposals", threadID))
	if err != nil {
		return false
	}
	for _, entry := range entries {
		if !entry.IsDir() || entry.Name() == excludeID || !validThread(entry.Name()) {
			continue
		}
		proposal, err := readProposal(filepath.Join(dir, "proposals", threadID, entry.Name(), "proposal.json"))
		if err == nil && proposal.Status == ProposalAwaitingConfirmation {
			return true
		}
	}
	return false
}

func loadProposalForApply(agentID, projectID, threadID, proposalID string) (string, chatIndex, Thread, Proposal, string, error) {
	if !validThread(threadID) || !validThread(proposalID) {
		return "", chatIndex{}, Thread{}, Proposal{}, "", errors.New("找不到這批提案")
	}
	dir, idx, err := loadChat(agentID, projectID)
	if err != nil {
		return "", chatIndex{}, Thread{}, Proposal{}, "", err
	}
	thread, ok := threadByID(idx, threadID)
	if !ok {
		return "", chatIndex{}, Thread{}, Proposal{}, "", errors.New("找不到這段對話")
	}
	path := filepath.Join(dir, "proposals", threadID, proposalID, "proposal.json")
	proposal, err := readProposal(path)
	if err != nil {
		return "", chatIndex{}, Thread{}, Proposal{}, "", err
	}
	if proposal.AgentID != agentID || proposal.ProjectID != projectID || proposal.ThreadID != threadID || proposal.ID != proposalID {
		return "", chatIndex{}, Thread{}, Proposal{}, "", errors.New("提案不屬於目前對話")
	}
	if err := verifyProposalHashes(proposal); err != nil {
		return "", chatIndex{}, Thread{}, Proposal{}, "", err
	}
	return dir, idx, thread, proposal, path, nil
}
