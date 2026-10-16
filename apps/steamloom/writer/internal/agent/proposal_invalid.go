package agent

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
)

// ProposalError 表示 Agent 的回答已完成，但交付的提案本身不能用（格式、欄位、目標或定位錯誤），
// 可以請同一個 Agent 修正。連線或伺服器錯誤不屬於這類，避免白白多燒一輪額度。
type ProposalError struct {
	Err       error
	Visible   string // envelope 前給作者看的自然語言摘要
	Raw       string // 含 envelope 的原始回答
	SessionID string
}

func (e *ProposalError) Error() string { return e.Err.Error() }
func (e *ProposalError) Unwrap() error { return e.Err }

// InvalidProposal 讓 Writer 的基準建立器標記「這是 Agent 能修正的提案錯誤」。
func InvalidProposal(err error) error {
	if err == nil {
		return nil
	}
	return &ProposalError{Err: err}
}

func proposalVisibleText(raw string) string {
	if index := firstEnvelopeIndex(raw); index >= 0 {
		return strings.TrimSpace(raw[:index])
	}
	return strings.TrimSpace(raw)
}

// proposalRepairPrompt 是自動修正那一輪的指示；只修正提案，不要求 Agent 重新創作。
func proposalRepairPrompt(err error) string {
	return fmt.Sprintf("Writer 無法使用你上一輪交付的提案，原因：%s\n請依成果規則重新輸出修正後的提案：先用一兩句說明修正了什麼，再附上完整 envelope。除非錯誤是內容對不上原文（例如 find 找不到或 marker 不存在），需要重新讀取原文後修正，否則不要改動內容本身。", err)
}

// recordProposalInvalid 先把原文存檔、再追加 proposal.invalid event，作者之後仍能打開原始輸出。
// 同時保存 provider session，讓作者在同一條 thread 接著請 Agent 處理。
func recordProposalInvalid(agentID, projectID, threadID, taskID string, invalid *ProposalError) error {
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
	event := taskEvent(EventProposalInvalid, taskID, invalid.Error())
	rawDir := filepath.Join(dir, "proposals", threadID, "invalid")
	if err := os.MkdirAll(rawDir, 0o700); err != nil {
		return err
	}
	if err := os.WriteFile(filepath.Join(rawDir, event.EventID+".txt"), []byte(invalid.Raw), 0o600); err != nil {
		return err
	}
	events := []ChatLine{}
	if invalid.Visible != "" {
		message := messageEvent("assistant", invalid.Visible)
		message.TaskID = taskID
		events = append(events, message)
	}
	if err := appendLines(filepath.Join(dir, thread.ID+".jsonl"), append(events, event)); err != nil {
		return err
	}
	if invalid.SessionID != "" {
		thread.SessionID = invalid.SessionID
	}
	thread.UpdatedAt = now()
	idx.Threads = upsertFront(idx.Threads, thread)
	return saveIndex(dir, idx)
}

// ProposalInvalidOutput 讀回某次提案失敗時保存的原始回答，只供作者檢視與複製。
func ProposalInvalidOutput(agentID, projectID, threadID, eventID string) (string, error) {
	chatMu.Lock()
	defer chatMu.Unlock()
	if !validThread(threadID) || !validThread(eventID) {
		return "", errors.New("找不到這份原始輸出")
	}
	dir, idx, err := loadChat(agentID, projectID)
	if err != nil {
		return "", err
	}
	if !hasThread(idx, threadID) {
		return "", errors.New("找不到這段對話")
	}
	raw, err := os.ReadFile(filepath.Join(dir, "proposals", threadID, "invalid", eventID+".txt"))
	if errors.Is(err, os.ErrNotExist) {
		return "", errors.New("找不到這份原始輸出")
	}
	return string(raw), err
}
