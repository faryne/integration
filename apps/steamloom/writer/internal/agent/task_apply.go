package agent

import (
	"context"
	"errors"
	"fmt"
	"sync"
)

// runApply 依作者核准的順序執行提案；媒體與資產由實際套用器回報更細的 job／檔案進度。
func (m *TaskManager) runApply(ctx context.Context, managed *managedTask) {
	task := managed.task
	proposal, err := recordApplyStarted(task.AgentID, task.ProjectID, task.ThreadID, managed.applyProposal.ID, task.ID)
	if err == nil {
		managed.applyProposal = &proposal
		m.emit(TaskEvent{Type: EventApplyStarted, Task: task, Proposal: &proposal})
		if m.apply == nil {
			err = errors.New("Writer 尚未設定提案寫入器")
		} else {
			items := proposal.ApplyItems()
			for itemIndex, item := range items {
				detailedProgress := item.ProposalType == ProposalTypeMediaBrief || item.ProposalType == ProposalTypeAssetUpload
				if !detailedProgress {
					proposal, err = recordApplyItem(task.AgentID, task.ProjectID, task.ThreadID, proposal.ID, task.ID, item.ID, EventApplyItemStarted, fmt.Sprintf("第 %d/%d 開始", itemIndex+1, len(items)))
					if err != nil {
						break
					}
					m.emit(TaskEvent{Type: EventApplyItemStarted, Task: task, Proposal: &proposal})
				}
				var progressMu sync.Mutex
				applyCtx := withApplyItemProgress(ctx, func(eventType, detail string) error {
					progressMu.Lock()
					defer progressMu.Unlock()
					var progressErr error
					proposal, progressErr = recordApplyItem(task.AgentID, task.ProjectID, task.ThreadID, proposal.ID, task.ID, item.ID, eventType, detail)
					if progressErr == nil {
						managed.applyProposal = &proposal
						m.emit(TaskEvent{Type: eventType, Task: task, Proposal: &proposal})
					}
					return progressErr
				})
				_, err = m.apply(applyCtx, proposal, item)
				if ctx.Err() != nil && (err == nil || !task.Background) {
					err = ctx.Err()
				}
				if err != nil {
					detail := err.Error()
					if !detailedProgress {
						detail = fmt.Sprintf("第 %d/%d 失敗：%v", itemIndex+1, len(items), err)
					}
					_, _ = recordApplyItem(task.AgentID, task.ProjectID, task.ThreadID, proposal.ID, task.ID, item.ID, EventApplyItemFailed, detail)
					m.emit(TaskEvent{Type: EventApplyItemFailed, Task: task, Proposal: &proposal})
					break
				}
				if !detailedProgress {
					proposal, err = recordApplyItem(task.AgentID, task.ProjectID, task.ThreadID, proposal.ID, task.ID, item.ID, EventApplyItemDone, fmt.Sprintf("第 %d/%d 完成", itemIndex+1, len(items)))
					if err != nil {
						break
					}
					m.emit(TaskEvent{Type: EventApplyItemDone, Task: task, Proposal: &proposal})
				}
			}
			if err == nil {
				summary := fmt.Sprintf("Writer 已依你的核准套用 %d 項提案。", len(proposal.ApplyItems()))
				proposal, err = recordApplyCompleted(task.AgentID, task.ProjectID, task.ThreadID, proposal.ID, task.ID, summary, managed.elapsedMS())
			}
		}
	}
	contextErr := ctx.Err()
	conflicted := errors.Is(err, ErrApplyConflict)
	if err != nil {
		detail := err.Error()
		// 媒體 Worker 停止時保留 adapter 訊息，作者才知道外部服務可能仍會完成並扣額度。
		if contextErr != nil && !task.Background {
			detail = "工作已停止"
		}
		var failed Proposal
		var saveErr error
		if conflicted {
			failed, saveErr = recordApplyConflict(task.AgentID, task.ProjectID, task.ThreadID, managed.applyProposal.ID, task.ID, detail, managed.task.Partial, managed.elapsedMS())
		} else {
			failed, saveErr = recordApplyFailed(task.AgentID, task.ProjectID, task.ThreadID, managed.applyProposal.ID, task.ID, detail, managed.task.Partial, managed.elapsedMS())
		}
		if saveErr == nil {
			proposal = failed
		} else {
			err = fmt.Errorf("%v；保存失敗狀態時發生：%w", err, saveErr)
		}
	}
	m.mu.Lock()
	managed.task.FinishedAt = now()
	managed.task.State = TaskApplied
	if err != nil {
		managed.task.State, managed.task.Error = TaskFailed, err.Error()
	}
	if conflicted {
		managed.task.State = TaskConflict
	}
	if contextErr != nil {
		managed.task.State = TaskCanceled
	}
	task = managed.task
	m.mu.Unlock()
	eventType := EventApplyCompleted
	if err != nil {
		eventType = EventApplyFailed
	}
	if conflicted {
		eventType = EventApplyConflict
	}
	m.emit(TaskEvent{Type: eventType, Task: task, Proposal: &proposal})
}
