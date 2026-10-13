package agent

import "testing"

func TestJSONObjectTakesLastCompleteObjectAroundWarnings(t *testing.T) {
	raw := jsonObject("warning: config {not-json}\n{\"type\":\"notice\"}\n{\"text\":\"完成\",\"nested\":{\"ok\":true}}\nwarning {still-not-json}")
	if string(raw) != `{"text":"完成","nested":{"ok":true}}` {
		t.Fatalf("unexpected JSON object: %s", raw)
	}
}

func TestParseClaude(t *testing.T) {
	reply, err := parseClaude("warning\n" + `{"is_error":false,"result":"完成","session_id":"claude-session"}`)
	if err != nil || reply.Text != "完成" || reply.SessionID != "claude-session" {
		t.Fatalf("unexpected Claude reply: %#v, %v", reply, err)
	}

	if _, err := parseClaude(`{"is_error":true,"result":"額度不足"}`); err == nil || err.Error() != "額度不足" {
		t.Fatalf("Claude structured error was not preserved: %v", err)
	}
}

func TestClaudeStreamEmitsDeltaAndToolLifecycle(t *testing.T) {
	var events []StreamEvent
	req := Request{emit: func(event StreamEvent) { events = append(events, event) }}
	tools := map[string]string{}
	emitClaudeStream(req, `{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"一段"}}}`, tools)
	emitClaudeStream(req, `{"type":"assistant","message":{"content":[{"type":"tool_use","id":"tool-1","name":"storyteller_get_story"}]}}`, tools)
	emitClaudeStream(req, `{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"tool-1"}]}}`, tools)
	if len(events) != 3 || events[0].Text != "一段" || events[1].Type != StreamToolStarted || events[2].ToolName != "storyteller_get_story" {
		t.Fatalf("unexpected Claude stream events: %#v", events)
	}
}

func TestParseCodexUsesLastAgentMessage(t *testing.T) {
	stdout := "" +
		`{"type":"thread.started","thread_id":"codex-session"}` + "\n" +
		`{"type":"item.completed","item":{"type":"agent_message","text":"中間回覆"}}` + "\n" +
		`{"type":"item.completed","item":{"type":"agent_message","text":"最後回覆"}}` + "\n" +
		`{"type":"turn.completed"}`
	reply, err := parseCodex(stdout)
	if err != nil || reply.Text != "最後回覆" || reply.SessionID != "codex-session" {
		t.Fatalf("unexpected Codex reply: %#v, %v", reply, err)
	}
}

func TestParseGrok(t *testing.T) {
	reply, err := parseGrok("notice: {not-json}\n" + `{"text":"完成","sessionId":"grok-session"}`)
	if err != nil || reply.Text != "完成" || reply.SessionID != "grok-session" {
		t.Fatalf("unexpected Grok reply: %#v, %v", reply, err)
	}

	if _, err := parseGrok(`{"type":"error","message":"未登入"}`); err == nil || err.Error() != "未登入" {
		t.Fatalf("Grok structured error was not preserved: %v", err)
	}
}

func TestParseGrokStreamingJSON(t *testing.T) {
	stdout := `{"sessionId":"grok-session","update":{"sessionUpdate":"agent_message_chunk","content":{"text":"前半"}}}` + "\n" +
		`{"sessionId":"grok-session","update":{"sessionUpdate":"agent_message_chunk","content":{"text":"後半"}}}`
	reply, err := parseGrok(stdout)
	if err != nil || reply.Text != "前半後半" || reply.SessionID != "grok-session" {
		t.Fatalf("unexpected Grok streaming reply: %#v, %v", reply, err)
	}
}

func TestCodexStreamEmitsFinalMessageAndToolLifecycle(t *testing.T) {
	var events []StreamEvent
	req := Request{emit: func(event StreamEvent) { events = append(events, event) }}
	tools := map[string]string{}
	emitCodexStream(req, `{"type":"item.started","item":{"id":"tool-1","type":"mcp_tool_call","server":"SteamLoom","tool":"storyteller_get_story"}}`, tools)
	emitCodexStream(req, `{"type":"item.completed","item":{"id":"tool-1","type":"mcp_tool_call"}}`, tools)
	emitCodexStream(req, `{"type":"item.completed","item":{"type":"agent_message","text":"完成"}}`, tools)
	if len(events) != 3 || events[0].ToolName != "SteamLoom.storyteller_get_story" || events[1].ToolName != events[0].ToolName || events[2].Text != "完成" {
		t.Fatalf("unexpected Codex stream events: %#v", events)
	}
}
