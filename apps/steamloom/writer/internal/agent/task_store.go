package agent

import (
	"errors"
	"path/filepath"
	"strings"
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
	message := messageEvent("user", req.Prompt)
	message.TaskID, message.References, message.Model, message.ReasoningEffort = taskID, req.References, req.Model, req.ReasoningEffort
	if err := appendLines(filepath.Join(dir, thread.ID+".jsonl"), []ChatLine{
		message,
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
	message := messageEvent("assistant", reply.Text)
	message.TaskID = taskID
	if err := appendLines(filepath.Join(dir, thread.ID+".jsonl"), []ChatLine{
		message,
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
	event := taskEvent(typeName, taskID, text)
	event.Action, event.Commands = loginAction(agentID, detail)
	events = append(events, event)
	return recordTaskState(agentID, projectID, threadID, taskID, state, events...)
}

// 工具執行紀錄屬於對話歷史，不改變 task/thread 狀態；重開 Writer 後仍能回看 Agent 做過什麼。
func recordTaskActivity(agentID, projectID, threadID, taskID, typeName, toolName, toolTarget string) error {
	if toolName == "" {
		return nil
	}
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
	text := "Agent 開始使用 " + toolName
	if typeName == EventTaskToolFinished {
		text = "Agent 已完成 " + toolName
	} else if typeName == EventTaskToolFailed {
		text = "Agent 執行失敗 " + toolName
	}
	event := taskEvent(typeName, taskID, text)
	event.ToolName = toolName
	event.ToolTarget = toolTarget
	if err := appendLines(filepath.Join(dir, thread.ID+".jsonl"), []ChatLine{event}); err != nil {
		return err
	}
	thread.UpdatedAt = now()
	idx.Threads = upsertFront(idx.Threads, thread)
	return saveIndex(dir, idx)
}

// Codex 的中途 agent_message 是進度說明，不是正式回答；保留在同一張執行紀錄供日後回看。
func recordTaskProgress(agentID, projectID, threadID, taskID, text string) error {
	text = strings.TrimSpace(text)
	if text == "" {
		return nil
	}
	return recordTaskState(agentID, projectID, threadID, taskID, TaskRunning, taskEvent(EventTaskProgress, taskID, text))
}

// 登入由使用者在 Terminal 完成；Writer 只把可執行指令附在失敗事件，不碰 Agent 憑證。
func loginAction(agentID, detail string) (string, []string) {
	lower := strings.ToLower(detail)
	loginRequired := strings.Contains(lower, "oauth session expired") || strings.Contains(lower, "failed to authenticate") ||
		strings.Contains(lower, "not logged in") || strings.Contains(lower, "login required") ||
		strings.Contains(lower, "invalid or expired credentials") || strings.Contains(lower, "request carried no credential") ||
		strings.Contains(lower, "authentication required") || strings.Contains(lower, "unauthorized (401)") ||
		strings.Contains(lower, "not authenticated") || strings.Contains(lower, "auth method") || strings.Contains(lower, "credentials not found") ||
		strings.Contains(detail, "未登入") || strings.Contains(detail, "登入已過期")
	if !loginRequired {
		return "", nil
	}
	commands := map[string]string{
		"claude": "claude auth login", "codex": "codex login", "grok": "grok login",
		"gemini": "gemini", "antigravity": "agy",
	}
	if command := commands[agentID]; command != "" {
		return "agent.login", []string{command}
	}
	return "", nil
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
