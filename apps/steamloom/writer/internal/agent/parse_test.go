package agent

import (
	"errors"
	"testing"
)

func TestJSONObjectTakesLastCompleteObjectAroundWarnings(t *testing.T) {
	raw := jsonObject("warning: config {not-json}\n{\"type\":\"notice\"}\n{\"text\":\"完成\",\"nested\":{\"ok\":true}}\nwarning {still-not-json}")
	if string(raw) != `{"text":"完成","nested":{"ok":true}}` {
		t.Fatalf("unexpected JSON object: %s", raw)
	}
}

func TestCommandErrorExplainsClaudeLogin(t *testing.T) {
	err := commandError("Claude Code", errors.New("exit status 1"), "Failed to authenticate: OAuth session expired and could not be refreshed")
	if err.Error() != "Claude Code 登入已過期，請先在 Terminal 執行 `claude auth login` 後再試" {
		t.Fatalf("unexpected Claude auth error: %v", err)
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
	tools := map[string]streamedTool{}
	emitClaudeStream(req, `{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"一段"}}}`, tools)
	emitClaudeStream(req, `{"type":"assistant","message":{"content":[{"type":"tool_use","id":"tool-1","name":"storyteller_get_story","input":{"story_public_id":"story-id"}}]}}`, tools)
	emitClaudeStream(req, `{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"tool-1"}]}}`, tools)
	if len(events) != 3 || events[0].Text != "一段" || events[1].Type != StreamToolStarted || events[1].ToolTarget != "story-id" || events[2].ToolName != "storyteller_get_story" || events[2].ToolTarget != "story-id" {
		t.Fatalf("unexpected Claude stream events: %#v", events)
	}
}

func TestProviderStreamsDoNotCountFailedToolsAsCompleted(t *testing.T) {
	tests := []struct {
		name string
		emit func(Request)
	}{
		{"claude", func(req Request) {
			tools := map[string]streamedTool{}
			emitClaudeStream(req, `{"type":"assistant","message":{"content":[{"type":"tool_use","id":"tool-1","name":"storyteller_upsert_lore"}]}}`, tools)
			emitClaudeStream(req, `{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"tool-1","is_error":true}]}}`, tools)
		}},
		{"codex", func(req Request) {
			stream := &codexStreamState{tools: map[string]streamedTool{}}
			emitCodexStream(req, `{"type":"item.started","item":{"id":"tool-1","type":"mcp_tool_call","server":"SteamLoom","tool":"storyteller_upsert_lore"}}`, stream)
			emitCodexStream(req, `{"type":"item.completed","item":{"id":"tool-1","type":"mcp_tool_call","status":"failed"}}`, stream)
		}},
		{"grok", func(req Request) {
			tools := map[string]streamedTool{}
			emitGrokStream(req, `{"update":{"sessionUpdate":"tool_call","toolCallId":"tool-1","title":"storyteller_upsert_lore"}}`, tools)
			emitGrokStream(req, `{"update":{"sessionUpdate":"tool_call_update","toolCallId":"tool-1","status":"failed"}}`, tools)
		}},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			var events []StreamEvent
			test.emit(Request{emit: func(event StreamEvent) { events = append(events, event) }})
			if len(events) != 2 || events[1].Type != StreamToolFailed {
				t.Fatalf("failed tool lifecycle was not preserved: %#v", events)
			}
		})
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

func TestParseGrokCurrentStreamingJSON(t *testing.T) {
	stdout := `{"type":"thought","data":"思考中"}` + "\n" +
		`{"type":"text","data":"前半"}` + "\n" +
		`{"type":"text","data":"後半"}` + "\n" +
		`{"type":"end","sessionId":"grok-session","stopReason":"end_turn"}`
	reply, err := parseGrok(stdout)
	if err != nil || reply.Text != "前半後半" || reply.SessionID != "grok-session" {
		t.Fatalf("unexpected current Grok streaming reply: %#v, %v", reply, err)
	}

	var events []StreamEvent
	emitGrokStream(Request{emit: func(event StreamEvent) { events = append(events, event) }}, `{"type":"text","data":"串流片段"}`, map[string]streamedTool{})
	if len(events) != 1 || events[0].Type != StreamAssistantDelta || events[0].Text != "串流片段" {
		t.Fatalf("unexpected current Grok stream events: %#v", events)
	}
	if !grokTerminalEvent(`{"type":"end","sessionId":"grok-session"}`) || grokTerminalEvent(`{"type":"text","data":"還在輸出"}`) {
		t.Fatal("Grok terminal event detection is incorrect")
	}
}

func TestGrokAuthenticationRetryFailsFast(t *testing.T) {
	line := `{"type":"retry_state","attempt":1,"maxRetries":50,"reason":"Re-authenticating after 401 (request carried no credential); retrying request"}`
	if !grokTerminalEvent(line) {
		t.Fatal("Grok authentication retry must stop immediately")
	}
	if _, err := parseGrok(line); err == nil || err.Error() != grokLoginError {
		t.Fatalf("unexpected Grok authentication error: %v", err)
	}
	legacy := `{"update":{"sessionUpdate":"retry_state","reason":"Re-authenticating after 401 (request carried no credential); retrying request"}}`
	if !grokTerminalEvent(legacy) {
		t.Fatal("legacy Grok authentication retry must stop immediately")
	}
	if err := commandError("Grok Build", errors.New("exit status 1"), "Unauthorized (401): Invalid or expired credentials"); err.Error() != grokLoginError {
		t.Fatalf("unexpected Grok stderr authentication error: %v", err)
	}
	action, commands := loginAction("grok", grokLoginError)
	if action != "agent.login" || len(commands) != 1 || commands[0] != "grok login" {
		t.Fatalf("Grok login action was not produced: %q, %#v", action, commands)
	}
	for _, detail := range []string{
		"You are not authenticated.",
		`Failed to fetch models error=Auth("No auth credentials for cli-chat-proxy")`,
		"auth recovery: credential-less 401, parking on uncharged resubmit",
	} {
		if !grokLoginRequired(detail) {
			t.Fatalf("Grok login output was not recognized: %s", detail)
		}
	}
	if !grokAuthenticated("You are logged in with grok.com.") || grokAuthenticated("You are not authenticated.") {
		t.Fatal("Grok auth preflight status was classified incorrectly")
	}
}

func TestCodexStreamSeparatesProgressFromFinalMessage(t *testing.T) {
	var events []StreamEvent
	req := Request{emit: func(event StreamEvent) { events = append(events, event) }}
	stream := &codexStreamState{tools: map[string]streamedTool{}}
	emitCodexStream(req, `{"type":"item.started","item":{"id":"tool-1","type":"mcp_tool_call","server":"SteamLoom","tool":"storyteller_get_story","arguments":{"story_public_id":"story-id"}}}`, stream)
	emitCodexStream(req, `{"type":"item.completed","item":{"id":"tool-1","type":"mcp_tool_call"}}`, stream)
	emitCodexStream(req, `{"type":"item.completed","item":{"type":"agent_message","text":"先讀取設定"}}`, stream)
	emitCodexStream(req, `{"type":"item.completed","item":{"type":"agent_message","text":"正式回答"}}`, stream)
	emitCodexStream(req, `{"type":"turn.completed"}`, stream)
	if len(events) != 6 || events[0].ToolName != "SteamLoom.storyteller_get_story" || events[0].ToolTarget != "story-id" || events[1].ToolName != events[0].ToolName || events[1].ToolTarget != "story-id" ||
		events[2].Type != StreamAgentPreview || events[2].Text != "先讀取設定" || events[3].Type != StreamAgentProgress || events[3].Text != "先讀取設定" ||
		events[4].Type != StreamAgentPreview || events[4].Text != "正式回答" || events[5].Type != StreamAgentPreview || events[5].Text != "" {
		t.Fatalf("unexpected Codex stream events: %#v", events)
	}
	for _, event := range events {
		if event.Type == StreamAssistantDelta {
			t.Fatalf("Codex agent_message leaked into the formal answer stream: %#v", events)
		}
	}
}

func TestAgentTerminalEvents(t *testing.T) {
	tests := []struct {
		name     string
		terminal func(string) bool
		done     []string
		pending  []string
	}{
		{
			name:     "Claude Code",
			terminal: claudeTerminalEvent,
			done:     []string{`{"type":"result","is_error":false,"result":"完成"}`, `{"type":"result","is_error":true,"result":"失敗"}`},
			pending:  []string{`{"type":"assistant"}`, `{"type":"stream_event"}`},
		},
		{
			name:     "Codex",
			terminal: codexTerminalEvent,
			done:     []string{`{"type":"turn.completed"}`, `{"type":"turn.failed"}`, `{"type":"error","message":"失敗"}`},
			pending:  []string{`{"type":"thread.started"}`, `{"type":"item.completed","item":{"type":"agent_message"}}`},
		},
		{
			name:     "Grok Build",
			terminal: grokTerminalEvent,
			done:     []string{`{"type":"end"}`, `{"type":"error","message":"失敗"}`},
			pending:  []string{`{"type":"text","data":"回答"}`, `{"update":{"sessionUpdate":"agent_message_chunk"}}`},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			for _, line := range test.done {
				if !test.terminal(line) {
					t.Fatalf("terminal event was not recognized: %s", line)
				}
			}
			for _, line := range test.pending {
				if test.terminal(line) {
					t.Fatalf("non-terminal event was treated as terminal: %s", line)
				}
			}
		})
	}
}
