package agent

import (
	"path/filepath"
	"sort"
)

// ProjectThread 是專案層級 task rail 的資料；同一 provider 可以有任意多條 thread。
type ProjectThread struct {
	ID            string `json:"id"`
	AgentID       string `json:"agent_id"`
	Title         string `json:"title"`
	UpdatedAt     string `json:"updated_at"`
	LastTaskState string `json:"last_task_state,omitempty"`
	ActiveTaskID  string `json:"active_task_id,omitempty"`
}

func ProjectThreads(projectID string) ([]ProjectThread, error) {
	chatMu.Lock()
	defer chatMu.Unlock()
	if err := validChatKey("claude", projectID); err != nil {
		return nil, err
	}
	threads := []ProjectThread{}
	for _, provider := range catalog {
		dir, idx, err := loadChat(provider.descriptor.ID, projectID)
		if err != nil {
			return nil, err
		}
		for _, thread := range idx.Threads {
			state, activeID, err := threadTaskState(filepath.Join(dir, thread.ID+".jsonl"), thread)
			if err != nil {
				return nil, err
			}
			threads = append(threads, ProjectThread{
				ID:            thread.ID,
				AgentID:       provider.descriptor.ID,
				Title:         thread.Title,
				UpdatedAt:     thread.UpdatedAt,
				LastTaskState: state,
				ActiveTaskID:  activeID,
			})
		}
	}
	sort.SliceStable(threads, func(i, j int) bool { return threads[i].UpdatedAt > threads[j].UpdatedAt })
	return threads, nil
}

func threadTaskState(path string, thread Thread) (string, string, error) {
	events, err := readLines(path)
	if err != nil {
		return "", "", err
	}
	states := map[string]string{}
	order := []string{}
	lastState, lastID := thread.LastTaskState, thread.ActiveTaskID
	for _, event := range events {
		if event.TaskID == "" {
			continue
		}
		switch event.Type {
		case EventTaskQueued:
			if _, exists := states[event.TaskID]; !exists {
				order = append(order, event.TaskID)
			}
			states[event.TaskID] = TaskQueued
		case EventTaskStarted:
			states[event.TaskID] = TaskRunning
		case EventTaskCompleted:
			states[event.TaskID], lastState, lastID = TaskCompleted, TaskCompleted, event.TaskID
		case EventTaskFailed:
			states[event.TaskID], lastState, lastID = TaskFailed, TaskFailed, event.TaskID
		case EventTaskCanceled:
			states[event.TaskID], lastState, lastID = TaskCanceled, TaskCanceled, event.TaskID
		case EventProposalReady:
			states[event.TaskID], lastState, lastID = TaskAwaitingConfirmation, TaskAwaitingConfirmation, event.TaskID
		case EventProposalApproved:
			states[event.TaskID], lastState, lastID = TaskApproved, TaskApproved, event.TaskID
		case EventProposalRejected:
			states[event.TaskID], lastState, lastID = TaskRejected, TaskRejected, event.TaskID
		case EventApplyQueued:
			if _, exists := states[event.TaskID]; !exists {
				order = append(order, event.TaskID)
			}
			states[event.TaskID], lastState, lastID = TaskQueued, TaskQueued, event.TaskID
		case EventApplyStarted:
			states[event.TaskID], lastState, lastID = TaskApplying, TaskApplying, event.TaskID
		case EventApplyCompleted:
			states[event.TaskID], lastState, lastID = TaskApplied, TaskApplied, event.TaskID
		case EventApplyFailed:
			states[event.TaskID], lastState, lastID = TaskFailed, TaskFailed, event.TaskID
		case EventApplyConflict:
			states[event.TaskID], lastState, lastID = TaskConflict, TaskConflict, event.TaskID
		case EventApplyInterrupted:
			states[event.TaskID], lastState, lastID = TaskVerificationRequired, TaskVerificationRequired, event.TaskID
		case EventApplyVerified:
			states[event.TaskID], lastState, lastID = TaskApplied, TaskApplied, event.TaskID
		}
	}
	for _, id := range order {
		if states[id] == TaskRunning {
			return TaskRunning, id, nil
		}
	}
	for _, id := range order {
		if states[id] == TaskQueued {
			return TaskQueued, id, nil
		}
	}
	for _, id := range order {
		if states[id] == TaskAwaitingConfirmation {
			return TaskAwaitingConfirmation, id, nil
		}
	}
	return lastState, lastID, nil
}
