package agent

import (
	"errors"
	"os"
	"path/filepath"
)

// RecoverInterruptedApplies 把只有 apply.started、沒有終局事件的工作標成需要確認。
// 重啟後絕不自動重送 mutation；append-only event 先落盤，snapshot 只是衍生快取。
func RecoverInterruptedApplies(projectID string, activeTaskIDs map[string]bool) error {
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
				// 同一個 Writer process 仍在等待 REST API 時不是中斷；只能復原前一個 process 留下的工作。
				if activeTaskIDs[lifecycle.taskID] {
					continue
				}
				// REST request 可能已抵達伺服器；Writer 重啟後不猜測結果也不自動重送。
				event := taskEvent(EventApplyInterrupted, lifecycle.taskID, "Writer 在取得套用結果前中斷；不會自動重送，請先確認內容")
				event.ProposalID, event.ContentHash = proposal.ID, proposal.ContentHash
				if err := appendLines(logPath, []ChatLine{event}); err != nil {
					return err
				}
				proposal.Status, proposal.InterruptedAt = ProposalVerificationRequired, event.CreatedAt
				thread.LastTaskState = TaskVerificationRequired
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
