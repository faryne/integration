package agent

import (
	"errors"
	"path/filepath"
)

// SaveTurn 只供測試建立既有對話紀錄；正式流程由 TaskManager 以 typed event 落盤。
func SaveTurn(agentID, projectID, threadID, prompt string, references []PromptReference, answer, sessionID string) (Thread, error) {
	chatMu.Lock()
	defer chatMu.Unlock()
	dir, idx, err := loadChat(agentID, projectID)
	if err != nil {
		return Thread{}, err
	}
	var thread Thread
	if threadID == "" {
		id, err := newThreadID()
		if err != nil {
			return Thread{}, err
		}
		thread = Thread{ID: id}
	} else {
		found, ok := threadByID(idx, threadID)
		if !ok || !validThread(threadID) {
			return Thread{}, errors.New("找不到這段對話")
		}
		thread = found
	}
	message := messageEvent("user", prompt)
	message.References = references
	if err := appendLines(filepath.Join(dir, thread.ID+".jsonl"), []ChatLine{
		message,
		messageEvent("assistant", answer),
	}); err != nil {
		return Thread{}, err
	}
	thread.SessionID = sessionID
	thread.UpdatedAt = now()
	if thread.Title == "" {
		thread.Title = clipTitle(prompt)
	}
	idx.Threads = upsertFront(idx.Threads, thread)
	idx.CurrentID = thread.ID
	if err := saveIndex(dir, idx); err != nil {
		return Thread{}, err
	}
	return thread, nil
}
