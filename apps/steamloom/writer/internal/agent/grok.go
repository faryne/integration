package agent

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
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

func newGrok(bin string) Client { return grokClient{bin: bin} }

func grokArgs(sessionID, dir, promptFile, mcpServer string) []string {
	return grokArgsWithTools(sessionID, dir, promptFile, mcpServer, writerReadOnlyTools)
}

func grokArgsWithTools(sessionID, dir, promptFile, mcpServer string, allowed []string) []string {
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
	for _, tool := range allowed {
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
	args := grokArgsWithTools(req.SessionID, dir, promptFile, req.mcpServer, req.mcpTools())
	if req.grant == nil || req.grant.assetMCP == nil {
		return args, nil
	}
	configDir := filepath.Join(dir, ".grok")
	if err := os.MkdirAll(configDir, 0o700); err != nil {
		return nil, err
	}
	serverArgs, _ := json.Marshal(req.grant.assetMCP.Args)
	config := fmt.Sprintf("[mcp_servers.%s]\ncommand = %s\nargs = %s\nenabled = true\n", strconv.Quote(assetMCPServerName), strconv.Quote(req.grant.assetMCP.Command), serverArgs)
	if err := os.WriteFile(filepath.Join(configDir, "config.toml"), []byte(config), 0o600); err != nil {
		return nil, err
	}
	return append(args, "--allow", "MCPTool("+assetMCPServerName+"__"+assetMCPToolName+")"), nil
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
	tools := map[string]string{}
	args, err := grokRequestArgs(req, dir, promptFile)
	if err != nil {
		return Reply{}, err
	}
	return invoke(ctx, invocation{
		name:   "Grok Build",
		bin:    c.bin,
		dir:    dir,
		args:   args,
		parse:  parseGrok,
		stream: func(line string) { emitGrokStream(req, line, tools) },
		resume: req.SessionID,
	})
}

type grokResult struct {
	Type      string          `json:"type"`
	Message   string          `json:"message"`
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

type grokStreamResult struct {
	grokResult
	Update struct {
		SessionUpdate string `json:"sessionUpdate"`
		ToolCallID    string `json:"toolCallId"`
		Title         string `json:"title"`
		Status        string `json:"status"`
		Content       struct {
			Text string `json:"text"`
		} `json:"content"`
	} `json:"update"`
}

func emitGrokStream(req Request, line string, tools map[string]string) {
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
		tools[result.Update.ToolCallID] = result.Update.Title
		req.emitStream(StreamEvent{Type: StreamToolStarted, ToolName: result.Update.Title})
	case "tool_call_update":
		if result.Update.Status == "completed" || result.Update.Status == "failed" {
			req.emitStream(StreamEvent{Type: StreamToolCompleted, ToolName: tools[result.Update.ToolCallID]})
		}
	}
}
