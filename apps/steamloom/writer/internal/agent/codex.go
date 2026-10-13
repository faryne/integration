package agent

import (
	"context"
	"encoding/json"
	"errors"
	"strconv"
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

func codexArgs(sessionID, dir, mcpServer string) []string {
	return codexArgsWithTools(sessionID, dir, mcpServer, writerReadOnlyTools)
}

func codexArgsWithTools(sessionID, dir, mcpServer string, allowed []string) []string {
	config := codexMCPConfig(mcpServer, allowed)
	// resume 子命令沒有 --color，色碼靠 --json 就不會進 stdout
	if sessionID != "" {
		args := []string{
			"exec", "resume",
			"--json",
			"--skip-git-repo-check",
			"-c", `sandbox_mode="read-only"`,
		}
		args = append(args, config...)
		return append(args, sessionID, "-")
	}
	args := []string{
		"exec",
		"--json",
		"--color", "never",
		"--sandbox", "read-only",
		"--skip-git-repo-check",
		"-C", dir,
	}
	args = append(args, config...)
	return append(args, "-")
}

func codexMCPConfig(server string, allowed []string) []string {
	if server == "" {
		return nil
	}
	tools, _ := json.Marshal(allowed)
	key := "mcp_servers." + server
	// Codex 自行使用既有 MCP 設定；未列入 enabled_tools 的 mutation 不會進入這輪工具集合。
	return []string{"-c", key + ".enabled_tools=" + string(tools), "-c", key + `.default_tools_approval_mode="approve"`}
}

func codexRequestArgs(req Request, dir string) ([]string, error) {
	// Codex 0.147 的 -c 不會把 quoted dotted key 合併回既有 MCP table，反而會建立
	// 名稱含引號的新 server 並報 invalid transport；只接受 TOML bare key 可表示的名稱。
	if req.mcpServer != "" && !codexBareKey(req.mcpServer) {
		return nil, errors.New("Codex 的 SteamLoom MCP 名稱只能使用英數字、- 或 _，請重新命名後再試")
	}
	args := codexArgsWithTools(req.SessionID, dir, req.mcpServer, req.mcpTools())
	if req.grant == nil || req.grant.assetMCP == nil {
		return args, nil
	}
	key := "mcp_servers." + assetMCPServerName
	serverArgs, _ := json.Marshal(req.grant.assetMCP.Args)
	toolNames, _ := json.Marshal([]string{assetMCPToolName})
	config := []string{
		"-c", key + ".command=" + strconv.Quote(req.grant.assetMCP.Command),
		"-c", key + ".args=" + string(serverArgs),
		"-c", key + ".enabled_tools=" + string(toolNames),
		"-c", key + `.default_tools_approval_mode="approve"`,
	}
	tail := 1
	if req.SessionID != "" {
		tail = 2
	}
	position := len(args) - tail
	return append(append(append([]string{}, args[:position]...), config...), args[position:]...), nil
}

func codexBareKey(value string) bool {
	if value == "" {
		return false
	}
	for _, char := range value {
		if (char < 'a' || char > 'z') && (char < 'A' || char > 'Z') && (char < '0' || char > '9') && char != '-' && char != '_' {
			return false
		}
	}
	return true
}

func (c codexClient) Ask(ctx context.Context, req Request) (Reply, error) {
	dir, err := req.dir()
	if err != nil {
		return Reply{}, err
	}
	args, err := codexRequestArgs(req, dir)
	if err != nil {
		return Reply{}, err
	}
	tools := map[string]streamedTool{}
	return invoke(ctx, invocation{
		name:   "Codex",
		bin:    c.bin,
		dir:    dir,
		args:   args,
		stdin:  req.body(),
		parse:  parseCodex,
		stream: func(line string) { emitCodexStream(req, line, tools) },
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

func emitCodexStream(req Request, line string, tools map[string]streamedTool) {
	var event struct {
		Type string `json:"type"`
		Item struct {
			ID        string          `json:"id"`
			Type      string          `json:"type"`
			Text      string          `json:"text"`
			Server    string          `json:"server"`
			Tool      string          `json:"tool"`
			Status    string          `json:"status"`
			Arguments json.RawMessage `json:"arguments"`
		} `json:"item"`
	}
	if json.Unmarshal([]byte(line), &event) != nil {
		return
	}
	if event.Type == "item.completed" && event.Item.Type == "agent_message" && event.Item.Text != "" {
		req.emitStream(StreamEvent{Type: StreamAssistantDelta, Text: event.Item.Text})
		return
	}
	if event.Item.Type != "mcp_tool_call" {
		return
	}
	name := strings.Trim(strings.Join([]string{event.Item.Server, event.Item.Tool}, "."), ".")
	if event.Type == "item.started" {
		tool := streamedTool{Name: name, Target: toolTarget(event.Item.Arguments)}
		tools[event.Item.ID] = tool
		req.emitStream(StreamEvent{Type: StreamToolStarted, ToolName: tool.Name, ToolTarget: tool.Target})
	} else if event.Type == "item.completed" {
		tool := tools[event.Item.ID]
		if name == "" {
			name = tool.Name
		}
		typeName := StreamToolCompleted
		if event.Item.Status == "failed" {
			typeName = StreamToolFailed
		}
		req.emitStream(StreamEvent{Type: typeName, ToolName: name, ToolTarget: tool.Target})
	}
}
