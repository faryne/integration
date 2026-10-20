package agent

import "time"

func proposalHasAsset(items []ProposalItem) bool {
	for _, item := range items {
		if item.Kind == ProposalKindAsset {
			return true
		}
	}
	return false
}

func taskQueueKey(task Task) string { return task.AgentID + "/" + task.ProjectID + "/" + task.ThreadID }

func (managed *managedTask) elapsedMS() int64 {
	if managed.startedAt.IsZero() {
		return 0
	}
	return max(time.Since(managed.startedAt).Milliseconds(), 1)
}

func removeQueuedTask(queue *taskQueue, taskID string) {
	if queue == nil {
		return
	}
	for i, managed := range queue.items {
		if managed.task.ID == taskID {
			queue.items = append(queue.items[:i], queue.items[i+1:]...)
			return
		}
	}
}
