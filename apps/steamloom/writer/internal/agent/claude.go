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
//	claude -p --output-format stream-json --include-partial-messages --verbose --tools "" --strict-mcp-config
//	claude -p --output-format stream-json --include-partial-messages --verbose --tools "" --strict-mcp-config --resume <session_id>
//
// --tools "" 關掉內建工具；有 SteamLoom MCP 時再用 allowedTools 精確放行唯讀工具。
// stdout 是一個 JSON：session_id 用來續聊，result 是回答，is_error 為 true 時 result 是錯誤。
type claudeClient struct{ bin string }

func newClaude(bin string) Client { return claudeClient{bin: bin} }

func claudeArgs(sessionID, mcpServer string) []string {
	args := []string{
		"-p",
		"--output-format", "stream-json",
		"--include-partial-messages",
		"--verbose",
		"--tools", "",
	}
	if mcpServer == "" {
		args = append(args, "--strict-mcp-config")
	} else {
		// Claude Code 自行載入使用者既有的 MCP 設定與 Skill；dontAsk 只執行 Writer 明確放行的唯讀工具。
		tools := claudeMCPTools(mcpServer, writerReadOnlyTools)
		args = append(args, "--allowedTools", tools, "--permission-mode", "dontAsk")
	}
	if sessionID != "" {
		args = append(args, "--resume", sessionID)
	}
	return args
}

func claudeMCPTools(server string, allowed []string) string {
	tools := make([]string, len(allowed))
	for i, tool := range allowed {
		tools[i] = "mcp__" + server + "__" + tool
	}
	return strings.Join(tools, ",")
}

func claudeRequestArgs(req Request) []string {
	return claudeArgs(req.SessionID, req.mcpServer)
}

func (c claudeClient) Ask(ctx context.Context, req Request) (Reply, error) {
	dir, err := req.dir()
	if err != nil {
		return Reply{}, err
	}
	tools := map[string]streamedTool{}
	return invoke(ctx, invocation{
		name:     "Claude Code",
		bin:      c.bin,
		dir:      dir,
		args:     claudeRequestArgs(req),
		stdin:    req.body(),
		parse:    parseClaude,
		stream:   func(line string) { emitClaudeStream(req, line, tools) },
		complete: claudeTerminalEvent,
		resume:   req.SessionID,
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

func emitClaudeStream(req Request, line string, tools map[string]streamedTool) {
	var message struct {
		Type  string `json:"type"`
		Event struct {
			Type  string `json:"type"`
			Delta struct {
				Type string `json:"type"`
				Text string `json:"text"`
			} `json:"delta"`
		} `json:"event"`
		Message struct {
			Content []struct {
				Type      string          `json:"type"`
				ID        string          `json:"id"`
				Name      string          `json:"name"`
				ToolUseID string          `json:"tool_use_id"`
				IsError   bool            `json:"is_error"`
				Input     json.RawMessage `json:"input"`
			} `json:"content"`
		} `json:"message"`
	}
	if json.Unmarshal([]byte(line), &message) != nil {
		return
	}
	if message.Type == "stream_event" && message.Event.Type == "content_block_delta" && message.Event.Delta.Type == "text_delta" && message.Event.Delta.Text != "" {
		req.emitStream(StreamEvent{Type: StreamAssistantDelta, Text: message.Event.Delta.Text})
		return
	}
	for _, content := range message.Message.Content {
		switch content.Type {
		case "tool_use":
			tool := streamedTool{Name: content.Name, Target: toolTarget(content.Input)}
			if content.ID != "" {
				tools[content.ID] = tool
			}
			req.emitStream(StreamEvent{Type: StreamToolStarted, ToolName: tool.Name, ToolTarget: tool.Target})
		case "tool_result":
			tool := tools[content.ToolUseID]
			typeName := StreamToolCompleted
			if content.IsError {
				typeName = StreamToolFailed
			}
			req.emitStream(StreamEvent{Type: typeName, ToolName: tool.Name, ToolTarget: tool.Target})
		}
	}
}

// result 是 Claude Code stream-json 的正式終局事件；收到後不再等待 CLI 程序自行退出。
func claudeTerminalEvent(line string) bool {
	var event struct {
		Type string `json:"type"`
	}
	return json.Unmarshal([]byte(line), &event) == nil && event.Type == "result"
}
