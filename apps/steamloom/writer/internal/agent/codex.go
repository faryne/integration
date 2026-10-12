package agent

import (
	"context"
	"encoding/json"
	"strings"
)

// Codex 的問答送出。題目用 "-" 從 stdin 讀。
//
// 新對話：
//
//	codex exec --json --color never --sandbox read-only --skip-git-repo-check -C <dir> -
//
// 續聊（resume 子命令沒有 --sandbox，改用 -c 覆寫同一個設定）：
//
//	codex exec resume --json --skip-git-repo-check -c sandbox_mode="read-only" <session_id> -
//
// stdout 是 JSONL。thread.started.thread_id 是續聊 id；
// 最後一則 item.completed 且 item.type 為 agent_message 的 item.text 是回答。
// turn.failed 或 error 代表這輪失敗。
type codexClient struct{ bin string }

func newCodex(bin string) Client { return codexClient{bin: bin} }

func codexArgs(sessionID, dir string) []string {
	// resume 子命令沒有 --color，色碼靠 --json 就不會進 stdout
	if sessionID != "" {
		return []string{
			"exec", "resume",
			"--json",
			"--skip-git-repo-check",
			"-c", `sandbox_mode="read-only"`,
			sessionID,
			"-",
		}
	}
	return []string{
		"exec",
		"--json",
		"--color", "never",
		"--sandbox", "read-only",
		"--skip-git-repo-check",
		"-C", dir,
		"-",
	}
}

func (c codexClient) Ask(ctx context.Context, req Request) (Reply, error) {
	dir, err := req.dir()
	if err != nil {
		return Reply{}, err
	}
	return invoke(ctx, invocation{
		name:   "Codex",
		bin:    c.bin,
		dir:    dir,
		args:   codexArgs(req.SessionID, dir),
		stdin:  req.body(),
		parse:  parseCodex,
		resume: req.SessionID,
	})
}

func parseCodex(stdout string) (Reply, error) {
	var sessionID, text, failed string
	for _, line := range strings.Split(stdout, "\n") {
		line = strings.TrimSpace(line)
		if line == "" || line[0] != '{' {
			continue
		}
		var event struct {
			Type     string          `json:"type"`
			ThreadID string          `json:"thread_id"`
			Message  string          `json:"message"`
			Error    json.RawMessage `json:"error"`
			Item     struct {
				Type string `json:"type"`
				Text string `json:"text"`
			} `json:"item"`
		}
		if json.Unmarshal([]byte(line), &event) != nil {
			continue
		}
		switch event.Type {
		case "thread.started":
			if event.ThreadID != "" {
				sessionID = event.ThreadID
			}
		case "item.completed":
			if event.Item.Type == "agent_message" && strings.TrimSpace(event.Item.Text) != "" {
				text = event.Item.Text
			}
		case "turn.failed":
			failed = codexMessage(event.Error, "Codex 沒有回答")
		case "error":
			if msg := strings.TrimSpace(event.Message); msg != "" {
				failed = msg
			} else if failed == "" {
				failed = codexMessage(event.Error, "Codex 沒有回答")
			}
		}
	}
	if failed != "" {
		return Reply{}, outputError{msg: failed}
	}
	if strings.TrimSpace(text) == "" {
		return Reply{}, errNoResult
	}
	return Reply{SessionID: sessionID, Text: text}, nil
}

func codexMessage(raw json.RawMessage, fallback string) string {
	if len(raw) == 0 {
		return fallback
	}
	var text string
	if json.Unmarshal(raw, &text) == nil && strings.TrimSpace(text) != "" {
		return text
	}
	var obj struct {
		Message string `json:"message"`
	}
	if json.Unmarshal(raw, &obj) == nil && strings.TrimSpace(obj.Message) != "" {
		return obj.Message
	}
	return fallback
}
