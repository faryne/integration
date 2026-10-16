package agent

import (
	"context"
	"encoding/json"
	"errors"
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
	config := codexMCPConfig(mcpServer, writerReadOnlyTools)
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
	return codexArgs(req.SessionID, dir, req.mcpServer), nil
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
	return invoke(ctx, invocation{
		name:    "Codex",
		bin:     c.bin,
		dir:     dir,
		args:    args,
		stdin:   req.body(),
		decoder: &codexProtocol{tools: map[string]streamedTool{}, server: req.mcpServer},
		emit:    req.emit,
		resume:  req.SessionID,
	})
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

// server 是使用者設定裡 SteamLoom MCP 的名稱；Codex 的 MCP 授權失敗只會出現在 stderr。
type codexProtocol struct {
	tools  map[string]streamedTool
	server string
}

func (p *codexProtocol) DecodeStderr(line string) []protocolEvent {
	if p.server == "" || !codexMCPAuthRequired(line) {
		return nil
	}
	return []protocolEvent{{Type: protocolMCPUnavailable, Text: "auth", Server: p.server}}
}

func (p *codexProtocol) Decode(line string) []protocolEvent {
	var event struct {
		Type     string          `json:"type"`
		ThreadID string          `json:"thread_id"`
		Message  string          `json:"message"`
		Error    json.RawMessage `json:"error"`
		Item     struct {
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
		return nil
	}
	if event.Type == "thread.started" {
		return []protocolEvent{{Type: protocolSession, SessionID: event.ThreadID}}
	}
	if event.Type == "item.completed" && event.Item.Type == "agent_message" && event.Item.Text != "" {
		return []protocolEvent{{Type: protocolTextCandidate, Text: event.Item.Text}}
	}
	if event.Type == "turn.completed" {
		return []protocolEvent{{Type: protocolCompleted}}
	}
	if event.Type == "turn.failed" {
		return []protocolEvent{{Type: protocolFailed, Text: codexMessage(event.Error, "Codex 沒有回答")}}
	}
	if event.Type == "error" {
		message := strings.TrimSpace(event.Message)
		if message == "" {
			message = codexMessage(event.Error, "Codex 沒有回答")
		}
		return []protocolEvent{{Type: protocolFailed, Text: message}}
	}
	if event.Item.Type != "mcp_tool_call" {
		return nil
	}
	name := strings.Trim(strings.Join([]string{event.Item.Server, event.Item.Tool}, "."), ".")
	if event.Type == "item.started" {
		tool := streamedTool{Name: name, Target: toolTarget(event.Item.Arguments)}
		p.tools[event.Item.ID] = tool
		return []protocolEvent{{Type: protocolToolStarted, ToolName: tool.Name, ToolTarget: tool.Target}}
	} else if event.Type == "item.completed" {
		tool := p.tools[event.Item.ID]
		if name == "" {
			name = tool.Name
		}
		typeName := protocolToolCompleted
		if event.Item.Status == "failed" {
			typeName = protocolToolFailed
		}
		return []protocolEvent{{Type: typeName, ToolName: name, ToolTarget: tool.Target}}
	}
	return nil
}
