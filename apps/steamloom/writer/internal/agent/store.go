package agent

import (
	"bufio"
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"time"
)

// 畫面一次只掛這麼多則。更早的留在檔案裡，往上載入再補。
const chatPageSize = 40

// Thread 是一個專案、一個 Agent 底下的一條對話串。
type Thread struct {
	ID            string `json:"id"`
	Title         string `json:"title"`
	SessionID     string `json:"session_id"`
	UpdatedAt     string `json:"updated_at"`
	LastTaskState string `json:"last_task_state,omitempty"`
	ActiveTaskID  string `json:"active_task_id,omitempty"`
}

// ChatPage 是開一條串時畫面上要的東西：串列表、目前這條、以及尾端的訊息。
type ChatPage struct {
	Threads   []Thread   `json:"threads"`
	CurrentID string     `json:"current_id"`
	SessionID string     `json:"session_id"`
	Messages  []ChatLine `json:"messages"`
	Start     int        `json:"start"`
	Total     int        `json:"total"`
}

// OlderMessages 是往上補的更早訊息。Start 是這批第一則在整份紀錄裡的位置。
type OlderMessages struct {
	Messages []ChatLine `json:"messages"`
	Start    int        `json:"start"`
	Total    int        `json:"total"`
}

type chatIndex struct {
	CurrentID string   `json:"current_id"`
	Threads   []Thread `json:"threads"`
}

var chatMu sync.Mutex
var userConfigDir = os.UserConfigDir

// OpenChat 讀出這個專案、這個 Agent 目前那一條的尾端。沒有對話時列表是空的。
func OpenChat(agentID, projectID string) (ChatPage, error) {
	chatMu.Lock()
	defer chatMu.Unlock()
	dir, idx, err := loadChat(agentID, projectID)
	if err != nil {
		return ChatPage{}, err
	}
	if len(idx.Threads) == 0 {
		return blankPage(), nil
	}
	if !hasThread(idx, idx.CurrentID) {
		idx.CurrentID = idx.Threads[0].ID
		if err := saveIndex(dir, idx); err != nil {
			return ChatPage{}, err
		}
	}
	return pageFrom(dir, idx, idx.CurrentID)
}

// SelectChat 把目前串換成 threadID，並回傳它的尾端。
func SelectChat(agentID, projectID, threadID string) (ChatPage, error) {
	chatMu.Lock()
	defer chatMu.Unlock()
	if !validThread(threadID) {
		return ChatPage{}, errors.New("找不到這段對話")
	}
	dir, idx, err := loadChat(agentID, projectID)
	if err != nil {
		return ChatPage{}, err
	}
	if !hasThread(idx, threadID) {
		return ChatPage{}, errors.New("找不到這段對話")
	}
	idx.CurrentID = threadID
	if err := saveIndex(dir, idx); err != nil {
		return ChatPage{}, err
	}
	return pageFrom(dir, idx, threadID)
}

// OlderChat 回傳 start 之前的一頁。start 是畫面上最舊一則的索引。
func OlderChat(agentID, projectID, threadID string, start int) (OlderMessages, error) {
	chatMu.Lock()
	defer chatMu.Unlock()
	if !validThread(threadID) {
		return OlderMessages{}, errors.New("找不到這段對話")
	}
	dir, idx, err := loadChat(agentID, projectID)
	if err != nil {
		return OlderMessages{}, err
	}
	if !hasThread(idx, threadID) {
		return OlderMessages{}, errors.New("找不到這段對話")
	}
	lines, err := readLines(filepath.Join(dir, threadID+".jsonl"))
	if err != nil {
		return OlderMessages{}, err
	}
	if start > len(lines) {
		start = len(lines)
	}
	if start < 0 {
		start = 0
	}
	from := start - chatPageSize
	if from < 0 {
		from = 0
	}
	return OlderMessages{Messages: cloneLines(lines[from:start]), Start: from, Total: len(lines)}, nil
}

// NewChat 開一條空的串。目前這條如果還是空的，就留在原地，避免堆出一堆空白對話。
func NewChat(agentID, projectID string) (ChatPage, error) {
	chatMu.Lock()
	defer chatMu.Unlock()
	dir, idx, err := loadChat(agentID, projectID)
	if err != nil {
		return ChatPage{}, err
	}
	if current, ok := threadByID(idx, idx.CurrentID); ok {
		lines, err := readLines(filepath.Join(dir, current.ID+".jsonl"))
		if err != nil {
			return ChatPage{}, err
		}
		if len(lines) == 0 {
			return pageFrom(dir, idx, current.ID)
		}
	}
	id, err := newThreadID()
	if err != nil {
		return ChatPage{}, err
	}
	idx.Threads = append([]Thread{{ID: id, UpdatedAt: now()}}, idx.Threads...)
	idx.CurrentID = id
	if err := saveIndex(dir, idx); err != nil {
		return ChatPage{}, err
	}
	return pageFrom(dir, idx, id)
}

// SessionOf 是這條串要拿去續聊的 CLI session。沒有這條串時回錯誤。
func SessionOf(agentID, projectID, threadID string) (string, error) {
	chatMu.Lock()
	defer chatMu.Unlock()
	if threadID == "" {
		return "", nil
	}
	if !validThread(threadID) {
		return "", errors.New("找不到這段對話")
	}
	_, idx, err := loadChat(agentID, projectID)
	if err != nil {
		return "", err
	}
	thread, ok := threadByID(idx, threadID)
	if !ok {
		return "", errors.New("找不到這段對話")
	}
	return thread.SessionID, nil
}

// SaveTurn 在 CLI 回答成功後，把這一來一回接到串的後面。threadID 空的就開新串。
func SaveTurn(agentID, projectID, threadID, prompt, answer, sessionID string) (Thread, error) {
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
	if err := appendLines(filepath.Join(dir, thread.ID+".jsonl"), []ChatLine{
		messageEvent("user", prompt),
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

// DeleteChat 永久刪除 Writer 本機 thread。Provider session 與 SteamLoom 內容不受影響。
func DeleteChat(agentID, projectID, threadID string) (ChatPage, error) {
	chatMu.Lock()
	defer chatMu.Unlock()
	if !validThread(threadID) {
		return ChatPage{}, errors.New("找不到這段對話")
	}
	dir, idx, err := loadChat(agentID, projectID)
	if err != nil {
		return ChatPage{}, err
	}
	if !hasThread(idx, threadID) {
		return ChatPage{}, errors.New("找不到這段對話")
	}

	next := idx
	next.Threads = make([]Thread, 0, len(idx.Threads)-1)
	for _, thread := range idx.Threads {
		if thread.ID != threadID {
			next.Threads = append(next.Threads, thread)
		}
	}
	if next.CurrentID == threadID {
		next.CurrentID = ""
		if len(next.Threads) > 0 {
			next.CurrentID = next.Threads[0].ID
		}
	}

	// 先改名成同目錄暫存檔，index 寫入失敗時還能復原，不留下指向不存在檔案的 thread。
	path := filepath.Join(dir, threadID+".jsonl")
	trash := path + ".deleting"
	moved := false
	if err := os.Rename(path, trash); err == nil {
		moved = true
	} else if !errors.Is(err, os.ErrNotExist) {
		return ChatPage{}, err
	}
	proposalPath := filepath.Join(dir, "proposals", threadID)
	proposalTrash := proposalPath + ".deleting"
	proposalMoved := false
	if err := os.Rename(proposalPath, proposalTrash); err == nil {
		proposalMoved = true
	} else if !errors.Is(err, os.ErrNotExist) {
		if moved {
			_ = os.Rename(trash, path)
		}
		return ChatPage{}, err
	}
	if err := saveIndex(dir, next); err != nil {
		if moved {
			_ = os.Rename(trash, path)
		}
		if proposalMoved {
			_ = os.Rename(proposalTrash, proposalPath)
		}
		return ChatPage{}, err
	}
	if moved {
		if err := os.Remove(trash); err != nil {
			_ = saveIndex(dir, idx)
			_ = os.Rename(trash, path)
			return ChatPage{}, err
		}
	}
	if proposalMoved {
		if err := os.RemoveAll(proposalTrash); err != nil {
			return ChatPage{}, err
		}
	}
	if len(next.Threads) == 0 {
		return blankPage(), nil
	}
	return pageFrom(dir, next, next.CurrentID)
}

func loadChat(agentID, projectID string) (string, chatIndex, error) {
	if err := validChatKey(agentID, projectID); err != nil {
		return "", chatIndex{}, err
	}
	base, err := userConfigDir()
	if err != nil {
		return "", chatIndex{}, err
	}
	// 路徑是 [agent]/[project]。跟 CLI 的工作目錄分開，避免問答紀錄被 agent 讀走。
	dir := filepath.Join(base, "SteamLoom Writer", "chats", segment(agentID), segment(projectID))
	if err := os.MkdirAll(dir, 0o700); err != nil {
		return "", chatIndex{}, err
	}
	idx, err := loadIndex(dir)
	if err != nil {
		return "", chatIndex{}, err
	}
	return dir, idx, nil
}

func validChatKey(agentID, projectID string) error {
	if projectID == "" {
		return errors.New("缺少專案資訊，無法開啟對話")
	}
	switch agentID {
	case "claude", "codex", "grok":
		return nil
	default:
		return errors.New("不支援的 AI Agent")
	}
}

func loadIndex(dir string) (chatIndex, error) {
	data, err := os.ReadFile(filepath.Join(dir, "index.json"))
	if errors.Is(err, os.ErrNotExist) {
		return chatIndex{Threads: []Thread{}}, nil
	}
	if err != nil {
		return chatIndex{}, err
	}
	var idx chatIndex
	if err := json.Unmarshal(data, &idx); err != nil {
		return chatIndex{}, err
	}
	if idx.Threads == nil {
		idx.Threads = []Thread{}
	}
	return idx, nil
}

func saveIndex(dir string, idx chatIndex) error {
	if idx.Threads == nil {
		idx.Threads = []Thread{}
	}
	data, err := json.MarshalIndent(idx, "", "  ")
	if err != nil {
		return err
	}
	tmp := filepath.Join(dir, "index.json.tmp")
	if err := os.WriteFile(tmp, append(data, '\n'), 0o600); err != nil {
		return err
	}
	return os.Rename(tmp, filepath.Join(dir, "index.json"))
}

func pageFrom(dir string, idx chatIndex, threadID string) (ChatPage, error) {
	lines, err := readLines(filepath.Join(dir, threadID+".jsonl"))
	if err != nil {
		return ChatPage{}, err
	}
	start := len(lines) - chatPageSize
	if start < 0 {
		start = 0
	}
	session := ""
	if thread, ok := threadByID(idx, threadID); ok {
		session = thread.SessionID
	}
	return ChatPage{
		Threads:   idx.Threads,
		CurrentID: threadID,
		SessionID: session,
		Messages:  cloneLines(lines[start:]),
		Start:     start,
		Total:     len(lines),
	}, nil
}

func blankPage() ChatPage {
	return ChatPage{Threads: []Thread{}, Messages: []ChatLine{}}
}

func readLines(path string) ([]ChatLine, error) {
	file, err := os.Open(path)
	if errors.Is(err, os.ErrNotExist) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	defer file.Close()
	scanner := bufio.NewScanner(file)
	scanner.Buffer(make([]byte, 64*1024), 4*1024*1024)
	var lines []ChatLine
	for scanner.Scan() {
		raw := strings.TrimSpace(scanner.Text())
		if raw == "" {
			continue
		}
		var line ChatLine
		if json.Unmarshal([]byte(raw), &line) != nil {
			continue
		}
		line, ok := normalizeEvent(line)
		if !ok {
			continue
		}
		lines = append(lines, line)
	}
	return lines, scanner.Err()
}

func appendLines(path string, lines []ChatLine) error {
	var buf strings.Builder
	for _, line := range lines {
		raw, err := json.Marshal(line)
		if err != nil {
			return err
		}
		buf.Write(raw)
		buf.WriteByte('\n')
	}
	file, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o600)
	if err != nil {
		return err
	}
	defer file.Close()
	_, err = file.WriteString(buf.String())
	return err
}

func cloneLines(lines []ChatLine) []ChatLine {
	if len(lines) == 0 {
		return []ChatLine{}
	}
	out := make([]ChatLine, len(lines))
	copy(out, lines)
	return out
}

func hasThread(idx chatIndex, id string) bool {
	_, ok := threadByID(idx, id)
	return ok
}

func threadByID(idx chatIndex, id string) (Thread, bool) {
	for _, thread := range idx.Threads {
		if thread.ID == id {
			return thread, true
		}
	}
	return Thread{}, false
}

func upsertFront(threads []Thread, thread Thread) []Thread {
	out := make([]Thread, 0, len(threads)+1)
	out = append(out, thread)
	for _, item := range threads {
		if item.ID != thread.ID {
			out = append(out, item)
		}
	}
	return out
}

func newThreadID() (string, error) {
	var buf [8]byte
	if _, err := rand.Read(buf[:]); err != nil {
		return "", err
	}
	return hex.EncodeToString(buf[:]), nil
}

func validThread(id string) bool {
	if len(id) != 16 {
		return false
	}
	for _, r := range id {
		if (r < '0' || r > '9') && (r < 'a' || r > 'f') {
			return false
		}
	}
	return true
}

func clipTitle(prompt string) string {
	text := strings.Join(strings.Fields(prompt), " ")
	runes := []rune(text)
	if len(runes) <= 24 {
		return text
	}
	return string(runes[:24]) + "…"
}

func now() string { return time.Now().Format(time.RFC3339) }
