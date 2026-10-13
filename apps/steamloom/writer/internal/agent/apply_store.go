package agent

import (
	"errors"
	"fmt"
	"path/filepath"
	"time"
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
	grantID, err := newThreadID()
	if err != nil {
		return Proposal{}, err
	}
	event := taskEvent(EventApplyStarted, taskID, "Agent 已開始執行核准的寫入")
	event.ProposalID, event.ContentHash = proposal.ID, proposal.ContentHash
	if err := appendLines(filepath.Join(dir, threadID+".jsonl"), []ChatLine{event}); err != nil {
		return Proposal{}, err
	}
	proposal.Status, proposal.GrantID = ProposalApplying, grantID
	proposal.GrantExpiresAt = time.Now().Add(15 * time.Minute).Format(time.RFC3339)
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
	return recordApplyOutcome(agentID, projectID, threadID, proposalID, taskID, ProposalApplied, TaskApplied, EventApplyCompleted, "Agent 已完成核准的寫入", reply)
}

func recordApplyFailed(agentID, projectID, threadID, proposalID, taskID, detail, partial string) (Proposal, error) {
	text := "Agent 寫入失敗"
	if detail != "" {
		text += "：" + detail
	}
	return recordApplyOutcome(agentID, projectID, threadID, proposalID, taskID, ProposalApplyFailed, TaskFailed, EventApplyFailed, text, partial)
}

func recordApplyConflict(agentID, projectID, threadID, proposalID, taskID, detail, partial string) (Proposal, error) {
	text := "資料已在確認後變更，Agent 未覆寫新版本"
	if detail != "" {
		text += "：" + detail
	}
	return recordApplyOutcome(agentID, projectID, threadID, proposalID, taskID, ProposalConflict, TaskConflict, EventApplyConflict, text, partial)
}

func recordApplyOutcome(agentID, projectID, threadID, proposalID, taskID, proposalState, taskState, eventType, eventText, reply string) (Proposal, error) {
	chatMu.Lock()
	defer chatMu.Unlock()
	dir, idx, thread, proposal, path, err := loadProposalForApply(agentID, projectID, threadID, proposalID)
	if err != nil {
		return Proposal{}, err
	}
	if proposal.Status != ProposalApplying && !(proposalState == ProposalApplyFailed && proposal.Status == ProposalApproved) {
		return Proposal{}, fmt.Errorf("提案目前是 %s，不能完成這次 apply", proposal.Status)
	}
	events := []ChatLine{}
	if reply != "" {
		line := messageEvent("assistant", reply)
		line.TaskID = taskID
		events = append(events, line)
	}
	event := taskEvent(eventType, taskID, eventText)
	event.ProposalID, event.ContentHash = proposal.ID, proposal.ContentHash
	events = append(events, event)
	if err := appendLines(filepath.Join(dir, threadID+".jsonl"), events); err != nil {
		return Proposal{}, err
	}
	proposal.Status, proposal.AppliedAt, proposal.GrantExpiresAt = proposalState, event.CreatedAt, ""
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
