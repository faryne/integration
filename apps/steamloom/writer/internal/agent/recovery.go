package agent

import (
	"errors"
	"os"
	"path/filepath"
)

// RecoverInterruptedApplies 把只有 apply.started、沒有終局事件的工作標成待查證。
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
				lifecycle, exists := proposalApplyLifecycle(filepath.Join(dir, thread.ID+".jsonl"), proposal.ID)
				if !exists || lifecycle.status != ProposalApplying {
					continue
				}
				event := taskEvent(EventApplyInterrupted, lifecycle.taskID, "Writer 在 Agent 回報寫入結果前中斷；不會自動重送，這批成果需要查證")
				event.ProposalID, event.ContentHash = proposal.ID, proposal.ContentHash
				if err := appendLines(filepath.Join(dir, thread.ID+".jsonl"), []ChatLine{event}); err != nil {
					return err
				}
				proposal.Status, proposal.InterruptedAt = ProposalVerificationRequired, event.CreatedAt
				proposal.GrantID, proposal.GrantExpiresAt = "", ""
				if err := writeProposal(path, proposal); err != nil {
					return err
				}
				thread.UpdatedAt, thread.LastTaskState, thread.ActiveTaskID = event.CreatedAt, TaskVerificationRequired, ""
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
