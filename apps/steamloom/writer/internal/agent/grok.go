package agent

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
)

// Grok Build 的問答送出。Grok 的 headless 不讀 stdin，題目寫進暫存檔。
//
// 新對話：
//
//	grok --prompt-file <file> --output-format json --verbatim --cwd <dir> \
//	  --sandbox strict --permission-mode dontAsk --no-subagents --disable-web-search \
//	  --tools "" --max-turns 2
//
// 續聊再加 --resume <session_id>。
// stdout 是一個 JSON：text 是回答，sessionId 用來續聊。
// 失敗時是 {"type":"error","message":"..."}，程序也會以非 0 結束。
type grokClient struct{ bin string }

func newGrok(bin string) Client { return grokClient{bin: bin} }

func grokArgs(sessionID, dir, promptFile string) []string {
	// --tools "" 是 allowlist：這輪不掛內建工具。strict 再把檔案範圍收在這個工作目錄。
	args := []string{
		"--prompt-file", promptFile,
		"--output-format", "json",
		"--verbatim",
		"--cwd", dir,
		"--sandbox", "strict",
		"--permission-mode", "dontAsk",
		"--no-subagents",
		"--disable-web-search",
		"--tools", "",
		"--max-turns", "2",
	}
	if sessionID != "" {
		args = append(args, "--resume", sessionID)
	}
	return args
}

func (c grokClient) Ask(ctx context.Context, req Request) (Reply, error) {
	dir, err := req.dir()
	if err != nil {
		return Reply{}, err
	}
	file, err := os.CreateTemp(dir, "prompt-*.txt")
	if err != nil {
		return Reply{}, err
	}
	promptFile := file.Name()
	defer os.Remove(promptFile)
	if _, err := file.WriteString(req.body()); err != nil {
		file.Close()
		return Reply{}, err
	}
	if err := file.Close(); err != nil {
		return Reply{}, err
	}
	rel, err := filepath.Rel(dir, promptFile)
	if err != nil || strings.HasPrefix(rel, "..") {
		return Reply{}, errors.New("無法建立提問暫存檔")
	}
	return invoke(ctx, invocation{
		name:   "Grok Build",
		bin:    c.bin,
		dir:    dir,
		args:   grokArgs(req.SessionID, dir, promptFile),
		parse:  parseGrok,
		resume: req.SessionID,
	})
}

type grokResult struct {
	Type      string `json:"type"`
	Message   string `json:"message"`
	Text      string `json:"text"`
	SessionID string `json:"sessionId"`
}

func parseGrok(stdout string) (Reply, error) {
	raw := jsonObject(stdout)
	if raw == nil {
		return Reply{}, errNoResult
	}
	var result grokResult
	if err := json.Unmarshal(raw, &result); err != nil {
		return Reply{}, errNoResult
	}
	if result.Type == "error" {
		msg := strings.TrimSpace(result.Message)
		if msg == "" {
			msg = "Grok Build 沒有回答"
		}
		return Reply{}, outputError{msg: msg}
	}
	if strings.TrimSpace(result.Text) == "" {
		return Reply{}, errNoResult
	}
	return Reply{SessionID: result.SessionID, Text: result.Text}, nil
}
