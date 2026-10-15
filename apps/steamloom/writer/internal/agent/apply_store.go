package agent

import (
	"errors"
	"fmt"
	"path/filepath"
)

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
	thread.UpdatedAt, thread.LastTaskState, thread.ActiveTaskID = now(), TaskApplying, taskID
	idx.Threads = upsertFront(idx.Threads, thread)
	if err := saveIndex(dir, idx); err != nil {
		return Proposal{}, err
	}
	return proposal, nil
}

func recordApplyCompleted(agentID, projectID, threadID, proposalID, taskID, reply string) (Proposal, error) {
	return recordApplyOutcome(agentID, projectID, threadID, proposalID, taskID, ProposalApplied, TaskApplied, EventApplyCompleted, "Writer 已完成提案套用", reply)
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
	event := taskEvent(EventApplyVerified, lifecycle.taskID, "你已確認內容成功套用；Writer 沒有再次送出寫入請求")
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
	thread.UpdatedAt, thread.LastTaskState, thread.ActiveTaskID = now(), taskState, ""
	idx.Threads = upsertFront(idx.Threads, thread)
	if err := saveIndex(dir, idx); err != nil {
		return Proposal{}, err
	}
	return proposal, nil
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
