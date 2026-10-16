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
		// 讀故事、設定與記憶通常需要多輪 tool call；仍受 Writer 的 TaskTimeouts 上限約束。
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
	args, err := grokRequestArgs(req, dir, promptFile)
	if err != nil {
		return Reply{}, err
	}
	return invoke(ctx, invocation{
		name:    "Grok Build",
		bin:     c.bin,
		dir:     dir,
		args:    args,
		decoder: &grokProtocol{tools: map[string]streamedTool{}},
		emit:    req.emit,
		resume:  req.SessionID,
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

type grokProtocol struct{ tools map[string]streamedTool }

func (p *grokProtocol) Decode(line string) []protocolEvent {
	var result grokStreamResult
	if json.Unmarshal([]byte(line), &result) != nil {
		return nil
	}
	events := []protocolEvent{}
	if result.SessionID != "" {
		events = append(events, protocolEvent{Type: protocolSession, SessionID: result.SessionID})
	}
	if result.loginRetry() {
		return append(events, protocolEvent{Type: protocolFailed, Text: grokLoginError})
	}
	if result.Type == "error" {
		message := strings.TrimSpace(result.Message)
		if message == "" {
			message = grokDataText(result.Data)
		}
		if message == "" {
			message = "Grok Build 沒有回答"
		}
		return append(events, protocolEvent{Type: protocolFailed, Text: message})
	}
	if result.Type == "text" {
		if text := grokDataText(result.Data); text != "" {
			events = append(events, protocolEvent{Type: protocolTextDelta, Text: text})
		}
	}
	switch result.Update.SessionUpdate {
	case "agent_message_chunk":
		if result.Update.Content.Text != "" {
			events = append(events, protocolEvent{Type: protocolTextDelta, Text: result.Update.Content.Text})
		}
	case "tool_call":
		tool := streamedTool{Name: result.Update.Title, Target: toolTarget(result.Update.Input, result.Update.Arguments, result.Update.RawInput)}
		p.tools[result.Update.ToolCallID] = tool
		events = append(events, protocolEvent{Type: protocolToolStarted, ToolName: tool.Name, ToolTarget: tool.Target})
	case "tool_call_update":
		if result.Update.Status == "completed" || result.Update.Status == "failed" {
			tool := p.tools[result.Update.ToolCallID]
			typeName := protocolToolCompleted
			if result.Update.Status == "failed" {
				typeName = protocolToolFailed
			}
			events = append(events, protocolEvent{Type: typeName, ToolName: tool.Name, ToolTarget: tool.Target})
		}
	}
	// 舊版 Grok 只回傳一次含 text 的 JSON；新 streaming-json 則由 end 結束。
	if result.Type == "end" || result.Type == "" && strings.TrimSpace(result.Text) != "" {
		events = append(events, protocolEvent{Type: protocolCompleted, Text: result.Text, SessionID: result.SessionID})
	}
	return events
}
