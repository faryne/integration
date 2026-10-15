package agent

import (
	"context"
	"encoding/json"
	"errors"
	"strings"
	"time"
)

// Gemini CLI 在 headless 模式由 stdin 接收題目，stream-json 提供 session、文字、tool 與終局事件。
// plan mode 限制為唯讀；allowed-tools 只替 Writer 明確列出的 SteamLoom 唯讀工具免除互動確認。
type geminiClient struct{ bin string }

func newGemini(bin string) Client { return geminiClient{bin: bin} }

func geminiArgs(sessionID, mcpServer string) []string {
	args := []string{"-p", "", "--output-format", "stream-json", "--approval-mode", "plan", "--skip-trust"}
	if mcpServer != "" {
		args = append(args, "--allowed-mcp-server-names", mcpServer, "--allowed-tools", strings.Join(geminiMCPTools(mcpServer, writerReadOnlyTools), ","))
	}
	if sessionID != "" {
		args = append(args, "--resume", sessionID)
	}
	return args
}

func geminiMCPTools(server string, allowed []string) []string {
	tools := make([]string, len(allowed))
	for i, tool := range allowed {
		tools[i] = "mcp_" + server + "_" + tool
	}
	return tools
}

func (c geminiClient) Ask(ctx context.Context, req Request) (Reply, error) {
	dir, err := req.dir()
	if err != nil {
		return Reply{}, err
	}
	if err := ensureGeminiFeatures(ctx, c.bin, dir); err != nil {
		return Reply{}, err
	}
	return invoke(ctx, invocation{
		name:    "Gemini CLI",
		bin:     c.bin,
		dir:     dir,
		args:    geminiArgs(req.SessionID, req.mcpServer),
		stdin:   req.body(),
		decoder: &geminiProtocol{tools: map[string]streamedTool{}},
		emit:    req.emit,
		resume:  req.SessionID,
	})
}

func ensureGeminiFeatures(ctx context.Context, bin, dir string) error {
	checkCtx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	output, err := runCombined(checkCtx, bin, dir, "--help")
	if err != nil {
		return commandError("Gemini CLI", err, output)
	}
	if !strings.Contains(output, "stream-json") || !strings.Contains(output, "approval-mode") {
		return errors.New("Gemini CLI 版本不支援 Writer 所需的 stream-json／plan mode，請先更新 Gemini CLI 後再試")
	}
	return nil
}

type geminiProtocol struct {
	tools     map[string]streamedTool
	lastError string
}

func (p *geminiProtocol) Decode(line string) []protocolEvent {
	var event struct {
		Type       string          `json:"type"`
		SessionID  string          `json:"session_id"`
		Role       string          `json:"role"`
		Content    string          `json:"content"`
		ToolName   string          `json:"tool_name"`
		ToolID     string          `json:"tool_id"`
		Parameters json.RawMessage `json:"parameters"`
		Status     string          `json:"status"`
		Message    string          `json:"message"`
		Error      json.RawMessage `json:"error"`
	}
	if json.Unmarshal([]byte(line), &event) != nil {
		return nil
	}
	switch event.Type {
	case "init":
		return []protocolEvent{{Type: protocolSession, SessionID: event.SessionID}}
	case "message":
		if event.Role == "assistant" && event.Content != "" {
			return []protocolEvent{{Type: protocolTextDelta, Text: event.Content}}
		}
	case "tool_use":
		tool := streamedTool{Name: event.ToolName, Target: toolTarget(event.Parameters)}
		p.tools[event.ToolID] = tool
		return []protocolEvent{{Type: protocolToolStarted, ToolName: tool.Name, ToolTarget: tool.Target}}
	case "tool_result":
		tool := p.tools[event.ToolID]
		typeName := protocolToolCompleted
		if !strings.EqualFold(event.Status, "success") {
			typeName = protocolToolFailed
		}
		return []protocolEvent{{Type: typeName, ToolName: tool.Name, ToolTarget: tool.Target}}
	case "error":
		p.lastError = strings.TrimSpace(event.Message)
		if p.lastError == "" {
			p.lastError = geminiErrorText(event.Error)
		}
	case "result":
		if strings.EqualFold(event.Status, "success") {
			return []protocolEvent{{Type: protocolCompleted, SessionID: event.SessionID}}
		}
		message := p.lastError
		if message == "" {
			message = geminiErrorText(event.Error)
		}
		if message == "" {
			message = "Gemini CLI 沒有回答"
		}
		return []protocolEvent{{Type: protocolFailed, Text: message, SessionID: event.SessionID}}
	}
	return nil
}

func geminiErrorText(raw json.RawMessage) string {
	var text string
	if json.Unmarshal(raw, &text) == nil {
		return strings.TrimSpace(text)
	}
	var object struct {
		Message string `json:"message"`
	}
	if json.Unmarshal(raw, &object) == nil {
		return strings.TrimSpace(object.Message)
	}
	return ""
}
