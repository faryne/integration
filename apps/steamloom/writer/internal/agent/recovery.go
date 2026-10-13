package agent

import (
	"errors"
	"os"
	"path/filepath"
)

// RecoverInterruptedApplies 把只有 apply.started、沒有終局事件的工作標成需要確認。
// 重啟後絕不自動重送 mutation；append-only event 先落盤，snapshot 只是衍生快取。
func RecoverInterruptedApplies(projectID string) error {
	chatMu.Lock()
	defer chatMu.Unlock()
	if err := validChatKey("claude", projectID); err != nil {
		return err
	}
	for _, provider := range catalog {
		dir, idx, err := loadChat(provider.id, projectID)
		if err != nil {
			return err
		}
		indexChanged := false
		for threadIndex := range idx.Threads {
			thread := &idx.Threads[threadIndex]
			logPath := filepath.Join(dir, thread.ID+".jsonl")
			events, err := readLines(logPath)
			if err != nil {
				return err
			}
			entries, err := os.ReadDir(filepath.Join(dir, "proposals", thread.ID))
			if errors.Is(err, os.ErrNotExist) {
				continue
			}
			if err != nil {
				return err
			}
			for _, entry := range entries {
				if !entry.IsDir() || !validThread(entry.Name()) {
					continue
				}
				path := filepath.Join(dir, "proposals", thread.ID, entry.Name(), "proposal.json")
				proposal, err := readProposal(path)
				if err != nil {
					return err
				}
				lifecycle, exists := proposalApplyLifecycle(logPath, proposal.ID)
				if !exists || lifecycle.status != ProposalApplying {
					continue
				}
				completed := persistedApplyCompleted(proposal, lifecycle.taskID, events)
				event := taskEvent(EventApplyInterrupted, lifecycle.taskID, "Writer 在 Agent 回報寫入結果前中斷；不會自動重送，請先確認內容")
				if completed {
					event = taskEvent(EventApplyCompleted, lifecycle.taskID, "Agent 已完成核准的寫入")
				}
				event.ProposalID, event.ContentHash = proposal.ID, proposal.ContentHash
				if err := appendLines(logPath, []ChatLine{event}); err != nil {
					return err
				}
				proposal.Status, proposal.InterruptedAt = ProposalVerificationRequired, event.CreatedAt
				thread.LastTaskState = TaskVerificationRequired
				if completed {
					proposal.Status, proposal.AppliedAt, proposal.InterruptedAt = ProposalApplied, event.CreatedAt, ""
					thread.LastTaskState = TaskApplied
				}
				proposal.GrantID, proposal.GrantExpiresAt = "", ""
				if err := writeProposal(path, proposal); err != nil {
					return err
				}
				thread.UpdatedAt, thread.ActiveTaskID = event.CreatedAt, ""
				indexChanged = true
			}
		}
		if indexChanged {
			if err := saveIndex(dir, idx); err != nil {
				return err
			}
		}
	}
	return nil
}

func persistedApplyCompleted(proposal Proposal, taskID string, events []ChatLine) bool {
	completed := []string{}
	started, failed := false, false
	for _, event := range events {
		if event.TaskID != taskID {
			continue
		}
		switch event.Type {
		case EventApplyStarted:
			started, failed, completed = true, false, nil
		case EventTaskToolFinished:
			if started {
				completed = append(completed, event.ToolName)
			}
		case EventTaskToolFailed:
			failed = true
		}
	}
	grant := ApprovalGrant{Items: proposal.Items}
	if proposalHasAsset(proposal.Items) {
		grant.AssetTool = assetMCPToolName
	}
	return started && !failed && verifyCompletedTools(grant, completed) == nil
}
