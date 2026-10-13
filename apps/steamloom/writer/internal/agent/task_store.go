package agent

import (
	"errors"
	"path/filepath"
)

// prepareTask 先把使用者訊息與 queued event 落盤；成功後 TaskManager 才能真的排程。
func prepareTask(agentID string, req Request, taskID string) (Thread, error) {
	chatMu.Lock()
	defer chatMu.Unlock()
	dir, idx, err := loadChat(agentID, req.ProjectID)
	if err != nil {
		return Thread{}, err
	}

	var thread Thread
	if req.ThreadID == "" {
		id, err := newThreadID()
		if err != nil {
			return Thread{}, err
		}
		thread = Thread{ID: id}
		idx.CurrentID = id
	} else {
		found, ok := threadByID(idx, req.ThreadID)
		if !ok || !validThread(req.ThreadID) {
			return Thread{}, errors.New("找不到這段對話")
		}
		thread = found
	}
	if err := appendLines(filepath.Join(dir, thread.ID+".jsonl"), []ChatLine{
		messageEvent("user", req.Prompt),
		taskEvent(EventTaskQueued, taskID, "工作已排入佇列"),
	}); err != nil {
		return Thread{}, err
	}
	thread.UpdatedAt = now()
	thread.LastTaskState = TaskQueued
	thread.ActiveTaskID = taskID
	if thread.Title == "" {
		thread.Title = clipTitle(req.Prompt)
	}
	idx.Threads = upsertFront(idx.Threads, thread)
	if err := saveIndex(dir, idx); err != nil {
		return Thread{}, err
	}
	return thread, nil
}

func recordTaskStarted(agentID, projectID, threadID, taskID string) error {
	return recordTaskState(agentID, projectID, threadID, taskID, TaskRunning, taskEvent(EventTaskStarted, taskID, "Agent 已開始處理"))
}

func recordTaskCompleted(agentID, projectID, threadID, taskID string, reply Reply) error {
	chatMu.Lock()
	defer chatMu.Unlock()
	dir, idx, err := loadChat(agentID, projectID)
	if err != nil {
		return err
	}
	thread, ok := threadByID(idx, threadID)
	if !ok {
		return errors.New("找不到這段對話")
	}
	if err := appendLines(filepath.Join(dir, thread.ID+".jsonl"), []ChatLine{
		messageEvent("assistant", reply.Text),
		taskEvent(EventTaskCompleted, taskID, "Agent 已完成工作"),
	}); err != nil {
		return err
	}
	thread.SessionID = reply.SessionID
	thread.UpdatedAt = now()
	thread.LastTaskState = TaskCompleted
	thread.ActiveTaskID = ""
	idx.Threads = upsertFront(idx.Threads, thread)
	return saveIndex(dir, idx)
}

func recordTaskStopped(agentID, projectID, threadID, taskID, state, detail, partial string) error {
	typeName, text := EventTaskFailed, "Agent 執行失敗："+detail
	if state == TaskCanceled {
		typeName, text = EventTaskCanceled, "工作已停止"
	}
	events := []ChatLine{}
	if partial != "" {
		events = append(events, ChatLine{Type: EventMessagePartial, Role: "assistant", Text: partial, CreatedAt: now(), TaskID: taskID})
	}
	events = append(events, taskEvent(typeName, taskID, text))
	return recordTaskState(agentID, projectID, threadID, taskID, state, events...)
}

func recordTaskState(agentID, projectID, threadID, taskID, state string, events ...ChatLine) error {
	chatMu.Lock()
	defer chatMu.Unlock()
	dir, idx, err := loadChat(agentID, projectID)
	if err != nil {
		return err
	}
	thread, ok := threadByID(idx, threadID)
	if !ok {
		return errors.New("找不到這段對話")
	}
	if err := appendLines(filepath.Join(dir, thread.ID+".jsonl"), events); err != nil {
		return err
	}
	thread.UpdatedAt = now()
	thread.LastTaskState = state
	thread.ActiveTaskID = ""
	if state == TaskQueued || state == TaskRunning {
		thread.ActiveTaskID = taskID
	}
	idx.Threads = upsertFront(idx.Threads, thread)
	return saveIndex(dir, idx)
}
