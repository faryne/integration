// Package agent 偵測本機的 AI CLI，並定義三家的問答送出介面。
// 呼叫端只組 Request、拿 Reply；每家各自把 Request 編成自己的指令。
package agent

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// 一輪問答的上限。寫作問答不跑工具，正常遠短於這個時間；逾時就停掉 CLI。
const askTimeout = 10 * time.Minute

// Request 是一輪問答。三家都吃這一包。對話掛在專案上，不掛某一篇文件。
// ThreadID 指出要接到哪一條本機對話；空的表示這則會開新串。
// SessionID 由那條串的紀錄決定，空字串才會讓 CLI 開新 session。
type Request struct {
	ThreadID   string `json:"thread_id"`
	SessionID  string `json:"session_id"`
	ProjectID  string `json:"project_id"`
	Kind       string `json:"kind"`
	DocumentID string `json:"document_id"`
	Title      string `json:"title"`
	Prompt     string `json:"prompt"`
}

// Reply 是這一輪的回答。ThreadID／Title 是存檔之後的結果，前端用來更新串列表。
type Reply struct {
	SessionID string `json:"session_id"`
	Text      string `json:"text"`
	ThreadID  string `json:"thread_id"`
	Title     string `json:"title"`
}

// Installed 是選單上的一項：這台機器找得到的 CLI。
type Installed struct {
	ID          string `json:"id"`
	DisplayName string `json:"display_name"`
	Path        string `json:"path"`
}

// Client 是一家 CLI 的問答送出介面。
type Client interface {
	Ask(ctx context.Context, req Request) (Reply, error)
}

type vendor struct {
	id, display, bin string
	new              func(path string) Client
}

// 順序就是選單順序。沒安裝的在 Detect 時拿掉。
var catalog = []vendor{
	{id: "claude", display: "Claude Code", bin: "claude", new: newClaude},
	{id: "codex", display: "Codex", bin: "codex", new: newCodex},
	{id: "grok", display: "Grok Build", bin: "grok", new: newGrok},
}

// Ask 把一輪問答交給 id 指定的那一家。
func Ask(ctx context.Context, id string, req Request) (Reply, error) {
	if err := req.validate(); err != nil {
		return Reply{}, err
	}
	client, err := open(id)
	if err != nil {
		return Reply{}, err
	}
	if ctx == nil {
		ctx = context.Background()
	}
	ctx, cancel := context.WithTimeout(ctx, askTimeout)
	defer cancel()
	return client.Ask(ctx, req)
}

func open(id string) (Client, error) {
	for _, item := range catalog {
		if item.id != id {
			continue
		}
		path, ok := lookup(item.bin)
		if !ok {
			return nil, fmt.Errorf("這台電腦沒有安裝 %s", item.display)
		}
		return item.new(path), nil
	}
	return nil, errors.New("不支援的 AI Agent")
}

func (r Request) validate() error {
	if strings.TrimSpace(r.Prompt) == "" {
		return errors.New("請輸入訊息")
	}
	if r.ProjectID == "" {
		return errors.New("缺少專案資訊，無法送出")
	}
	if !validSession(r.SessionID) {
		return errors.New("對話編號不正確，請重新開一段對話")
	}
	return nil
}

// 只接受 CLI 回傳的 session id，避免被當成額外的指令參數。
func validSession(id string) bool {
	if id == "" {
		return true
	}
	if len(id) > 200 || strings.HasPrefix(id, "-") || strings.ContainsAny(id, " \t\r\n\"'\\/") {
		return false
	}
	return true
}

// 每輪都帶上專案名稱與限制。題目若以 / 開頭，也不會被 CLI 當成斜線指令。
func (r Request) body() string {
	title := strings.TrimSpace(r.Title)
	if title == "" {
		title = "未命名"
	}
	return fmt.Sprintf("你是 SteamLoom Writer 裡的寫作助手。作者正在看專案〈%s〉。只用自然語言回答寫作問題，不要修改檔案，也不要執行指令。\n\n作者的問題：\n%s", title, strings.TrimSpace(r.Prompt))
}

// 問答的工作目錄跟作品倉庫分開，CLI 才不會把 Writer 的專案當成程式專案去改。
func (r Request) dir() (string, error) {
	base, err := os.UserConfigDir()
	if err != nil {
		return "", err
	}
	dir := filepath.Join(base, "SteamLoom Writer", "agent-sessions", segment(r.ProjectID))
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return "", err
	}
	return dir, nil
}

func segment(value string) string {
	var b strings.Builder
	for _, r := range value {
		switch {
		case r <= 0x1f || strings.ContainsRune(`/\:*?"<>|`, r):
			b.WriteByte('_')
		default:
			b.WriteRune(r)
		}
	}
	s := b.String()
	if s == "" || s == "." || s == ".." {
		return "_"
	}
	if len(s) > 80 {
		return s[:80]
	}
	return s
}
