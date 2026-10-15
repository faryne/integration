package agent

import (
	"context"
	"encoding/json"
	"errors"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// Grok Build 的問答送出。Grok 的 headless 不讀 stdin，題目寫進暫存檔。
//
// 新對話：
//
//	grok --no-auto-update --prompt-file <file> --output-format streaming-json --verbatim --cwd <dir> \
//	  --sandbox strict --permission-mode dontAsk --no-subagents --disable-web-search \
//	  --tools "" --max-turns 12 [--allow MCPTool(...)]
//
// 續聊再加 --resume <session_id>。
// stdout 是一個 JSON：text 是回答，sessionId 用來續聊。
// 失敗時是 {"type":"error","message":"..."}，程序也會以非 0 結束。
type grokClient struct{ bin string }

// Grok 的 OAuth refresh 會寫 ~/.grok/auth.json.lock；strict sandbox 不允許。
// preflight 不接 prompt、沒有 Agent 工具，集中執行可避免多條 thread 同時搶 token lock。
var grokAuthGate = make(chan struct{}, 1)

func newGrok(bin string) Client { return grokClient{bin: bin} }

func grokArgs(sessionID, dir, promptFile, mcpServer string) []string {
	// --tools "" 不掛內建工具；strict 再把檔案範圍收在這個工作目錄。
	args := []string{
		// Writer 自己負責版本相容性；headless 問答期間不要讓 CLI 在背景更新，避免同一條對話前後行為漂移。
		"--no-auto-update",
		"--prompt-file", promptFile,
		"--output-format", "streaming-json",
		"--verbatim",
		"--cwd", dir,
		"--sandbox", "strict",
		"--permission-mode", "dontAsk",
		"--no-subagents",
		"--disable-web-search",
		"--tools", "",
		// 讀故事、設定與記憶通常需要多輪 tool call；仍受 Writer 的 10 分鐘 task timeout 約束。
		"--max-turns", "12",
	}
	// Grok Build 自行載入使用者既有的 MCP 設定；dontAsk 只核准精確列出的 SteamLoom 唯讀工具。
	for _, tool := range writerReadOnlyTools {
		if mcpServer != "" {
			args = append(args, "--allow", "MCPTool("+mcpServer+"__"+tool+")")
		}
	}
	if sessionID != "" {
		args = append(args, "--resume", sessionID)
	}
	return args
}

func grokRequestArgs(req Request, dir, promptFile string) ([]string, error) {
	return grokArgs(req.SessionID, dir, promptFile, req.mcpServer), nil
}

func (c grokClient) Ask(ctx context.Context, req Request) (Reply, error) {
	dir, err := req.dir()
	if err != nil {
		return Reply{}, err
	}
	if err := ensureGrokAuth(ctx, c.bin, dir); err != nil {
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
	tools := map[string]streamedTool{}
	args, err := grokRequestArgs(req, dir, promptFile)
	if err != nil {
		return Reply{}, err
	}
	return invoke(ctx, invocation{
		name:     "Grok Build",
		bin:      c.bin,
		dir:      dir,
		args:     args,
		parse:    parseGrok,
		stream:   func(line string) { emitGrokStream(req, line, tools) },
		complete: grokTerminalEvent,
		resume:   req.SessionID,
	})
}

const grokAuthCheckTimeout = 20 * time.Second

func ensureGrokAuth(ctx context.Context, bin, dir string) error {
	select {
	case grokAuthGate <- struct{}{}:
		defer func() { <-grokAuthGate }()
	case <-ctx.Done():
		return ctx.Err()
	}
	// 第一次檢查若遇到過期 token，Grok 會在程序結束前完成 refresh，但該次輸出仍可能是未登入；
	// 因此只在未登入時再確認一次，避免把已更新好的憑證誤判為失效。
	for attempt := 0; attempt < 2; attempt++ {
		checkCtx, cancel := context.WithTimeout(ctx, grokAuthCheckTimeout)
		output, err := runCombined(checkCtx, bin, dir, "--no-auto-update", "--sandbox", "off", "models")
		cancel()
		if grokAuthenticated(output) {
			return nil
		}
		if grokLoginRequired(output) {
			if attempt == 0 {
				continue
			}
			return errors.New(grokLoginError)
		}
		if err != nil {
			if ctx.Err() != nil {
				return ctx.Err()
			}
			return commandError("Grok Build", err, output)
		}
		// 舊版沒有固定的登入狀態文字；交回正式請求處理，避免 preflight 破壞相容性。
		return nil
	}
	return errors.New(grokLoginError)
}

func grokAuthenticated(detail string) bool {
	lower := strings.ToLower(detail)
	return strings.Contains(lower, "you are logged in") || strings.Contains(lower, "authenticated with grok.com")
}

type grokResult struct {
	Type      string          `json:"type"`
	Message   string          `json:"message"`
	Reason    string          `json:"reason"`
	Text      string          `json:"text"`
	Data      json.RawMessage `json:"data"`
	SessionID string          `json:"sessionId"`
}

func parseGrok(stdout string) (Reply, error) {
	var sessionID, text, finalText, failed string
	for _, line := range strings.Split(stdout, "\n") {
		var result grokStreamResult
		if json.Unmarshal([]byte(strings.TrimSpace(line)), &result) != nil {
			continue
		}
		if result.SessionID != "" {
			sessionID = result.SessionID
		}
		if result.Type == "error" {
			failed = strings.TrimSpace(result.Message)
			if failed == "" {
				failed = grokDataText(result.Data)
			}
		}
		if result.loginRetry() {
			failed = grokLoginError
		}
		// Grok Build 1.0.50 的 streaming-json 改成 {"type":"text","data":"..."}；
		// 舊版 ACP 的 agent_message_chunk 仍保留相容，避免使用者尚未更新時中斷。
		if result.Type == "text" {
			text += grokDataText(result.Data)
		}
		if strings.TrimSpace(result.Text) != "" {
			finalText = result.Text
		}
		if result.Update.SessionUpdate == "agent_message_chunk" {
			text += result.Update.Content.Text
		}
	}
	if failed != "" {
		return Reply{}, outputError{msg: failed}
	}
	if strings.TrimSpace(finalText) != "" {
		text = finalText
	}
	if strings.TrimSpace(text) == "" {
		return Reply{}, errNoResult
	}
	return Reply{SessionID: sessionID, Text: text}, nil
}

func grokDataText(raw json.RawMessage) string {
	var text string
	if json.Unmarshal(raw, &text) != nil {
		return ""
	}
	return text
}

const grokLoginError = "Grok Build 登入已過期，請先在 Terminal 執行 `grok login` 後再試"

func grokLoginRequired(detail string) bool {
	lower := strings.ToLower(detail)
	return strings.Contains(lower, "re-authenticating after 401") || strings.Contains(lower, "invalid or expired credentials") ||
		strings.Contains(lower, "request carried no credential") || strings.Contains(lower, "unauthorized (401)") ||
		strings.Contains(lower, "you are not authenticated") || strings.Contains(lower, "no auth credentials") ||
		strings.Contains(lower, "credential-less 401") || strings.Contains(lower, "authentication required") ||
		strings.Contains(lower, "not logged in") || strings.Contains(lower, "login required")
}

type grokStreamResult struct {
	grokResult
	Update struct {
		SessionUpdate string `json:"sessionUpdate"`
		ToolCallID    string `json:"toolCallId"`
		Title         string `json:"title"`
		Status        string `json:"status"`
		Reason        string `json:"reason"`
		Content       struct {
			Text string `json:"text"`
		} `json:"content"`
		Input     json.RawMessage `json:"input"`
		Arguments json.RawMessage `json:"arguments"`
		RawInput  json.RawMessage `json:"rawInput"`
	} `json:"update"`
}

func (r grokStreamResult) loginRetry() bool {
	if r.Type == "retry_state" {
		return grokLoginRequired(r.Reason)
	}
	return r.Update.SessionUpdate == "retry_state" && grokLoginRequired(r.Update.Reason)
}

func emitGrokStream(req Request, line string, tools map[string]streamedTool) {
	var result grokStreamResult
	if json.Unmarshal([]byte(line), &result) != nil {
		return
	}
	if result.Type == "text" {
		if text := grokDataText(result.Data); text != "" {
			req.emitStream(StreamEvent{Type: StreamAssistantDelta, Text: text})
		}
		return
	}
	switch result.Update.SessionUpdate {
	case "agent_message_chunk":
		if result.Update.Content.Text != "" {
			req.emitStream(StreamEvent{Type: StreamAssistantDelta, Text: result.Update.Content.Text})
		}
	case "tool_call":
		tool := streamedTool{Name: result.Update.Title, Target: toolTarget(result.Update.Input, result.Update.Arguments, result.Update.RawInput)}
		tools[result.Update.ToolCallID] = tool
		req.emitStream(StreamEvent{Type: StreamToolStarted, ToolName: tool.Name, ToolTarget: tool.Target})
	case "tool_call_update":
		if result.Update.Status == "completed" || result.Update.Status == "failed" {
			tool := tools[result.Update.ToolCallID]
			typeName := StreamToolCompleted
			if result.Update.Status == "failed" {
				typeName = StreamToolFailed
			}
			req.emitStream(StreamEvent{Type: typeName, ToolName: tool.Name, ToolTarget: tool.Target})
		}
	}
}

func grokTerminalEvent(line string) bool {
	var result grokStreamResult
	return json.Unmarshal([]byte(line), &result) == nil && (result.Type == "end" || result.Type == "error" ||
		result.loginRetry())
}
