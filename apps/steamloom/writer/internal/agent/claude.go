package agent

import (
	"context"
	"encoding/json"
	"strings"
)

// Claude Code 的問答送出。
//
// 新對話與續聊都是一次 headless 程序，題目走 stdin（避免命令列長度上限）：
//
//	claude -p --output-format json --tools "" --disable-slash-commands --strict-mcp-config
//	claude -p --output-format json --tools "" --disable-slash-commands --strict-mcp-config --resume <session_id>
//
// --tools "" 關掉內建工具，這輪只回答、不改檔。
// stdout 是一個 JSON：session_id 用來續聊，result 是回答，is_error 為 true 時 result 是錯誤。
type claudeClient struct{ bin string }

func newClaude(bin string) Client { return claudeClient{bin: bin} }

func claudeArgs(sessionID string) []string {
	args := []string{
		"-p",
		"--output-format", "json",
		"--tools", "",
		"--disable-slash-commands",
		"--strict-mcp-config",
	}
	if sessionID != "" {
		args = append(args, "--resume", sessionID)
	}
	return args
}

func (c claudeClient) Ask(ctx context.Context, req Request) (Reply, error) {
	dir, err := req.dir()
	if err != nil {
		return Reply{}, err
	}
	return invoke(ctx, invocation{
		name:   "Claude Code",
		bin:    c.bin,
		dir:    dir,
		args:   claudeArgs(req.SessionID),
		stdin:  req.body(),
		parse:  parseClaude,
		resume: req.SessionID,
	})
}

type claudeResult struct {
	IsError   bool   `json:"is_error"`
	Result    string `json:"result"`
	SessionID string `json:"session_id"`
}

func parseClaude(stdout string) (Reply, error) {
	raw := jsonObject(stdout)
	if raw == nil {
		return Reply{}, errNoResult
	}
	var result claudeResult
	if err := json.Unmarshal(raw, &result); err != nil {
		return Reply{}, errNoResult
	}
	if result.IsError {
		msg := strings.TrimSpace(result.Result)
		if msg == "" {
			msg = "Claude Code 沒有回答"
		}
		return Reply{}, outputError{msg: msg}
	}
	if strings.TrimSpace(result.Result) == "" {
		return Reply{}, errNoResult
	}
	return Reply{SessionID: result.SessionID, Text: result.Result}, nil
}
