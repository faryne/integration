package agent

import (
	"errors"
	"strings"
	"testing"
)

func decodeProtocol(decoder protocolDecoder, lines ...string) (Reply, error, []StreamEvent) {
	events := []StreamEvent{}
	state := newProtocolState("", func(event StreamEvent) { events = append(events, event) })
	for _, line := range lines {
		state.Consume(decoder.Decode(line))
	}
	reply, err := state.Reply()
	return reply, err, events
}

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

func TestCommandErrorExplainsGeminiAndAntigravityLogin(t *testing.T) {
	tests := []struct {
		name, detail, command string
	}{
		{"Gemini CLI", "Please set an Auth method before continuing", "gemini"},
		{"Antigravity", "authentication required", "agy"},
	}
	for _, test := range tests {
		err := commandError(test.name, errors.New("exit status 1"), test.detail)
		if !strings.Contains(err.Error(), "尚未登入") || !strings.Contains(err.Error(), "`"+test.command+"`") {
			t.Fatalf("unexpected %s auth error: %v", test.name, err)
		}
	}
}

func TestProviderProtocolReplies(t *testing.T) {
	tests := []struct {
		name    string
		decoder protocolDecoder
		lines   []string
		text    string
		session string
	}{
		{
			name: "Claude Code", decoder: &claudeProtocol{tools: map[string]streamedTool{}},
			lines: []string{
				`{"type":"stream_event","session_id":"claude-session","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"完"}}}`,
				`{"type":"stream_event","event":{"type":"content_block_delta","delta":{"type":"text_delta","text":"成"}}}`,
				`{"type":"result","is_error":false,"result":"完成","session_id":"claude-session"}`,
			},
			text: "完成", session: "claude-session",
		},
		{
			name: "Codex", decoder: &codexProtocol{tools: map[string]streamedTool{}},
			lines: []string{
				`{"type":"thread.started","thread_id":"codex-session"}`,
				`{"type":"item.completed","item":{"type":"agent_message","text":"中間回覆"}}`,
				`{"type":"item.completed","item":{"type":"agent_message","text":"最後回覆"}}`,
				`{"type":"turn.completed"}`,
			},
			text: "最後回覆", session: "codex-session",
		},
		{
			name: "Grok Build", decoder: &grokProtocol{tools: map[string]streamedTool{}},
			lines: []string{
				`{"type":"text","data":"前半"}`,
				`{"type":"text","data":"後半"}`,
				`{"type":"end","sessionId":"grok-session","stopReason":"end_turn"}`,
			},
			text: "前半後半", session: "grok-session",
		},
		{
			name: "Grok Build legacy", decoder: &grokProtocol{tools: map[string]streamedTool{}},
			lines: []string{`{"text":"完成","sessionId":"grok-session"}`},
			text:  "完成", session: "grok-session",
		},
		{
			name: "Gemini CLI", decoder: &geminiProtocol{tools: map[string]streamedTool{}},
			lines: []string{
				`{"type":"init","session_id":"gemini-session","model":"gemini"}`,
				`{"type":"message","role":"assistant","content":"前半","delta":true}`,
				`{"type":"message","role":"assistant","content":"後半","delta":true}`,
				`{"type":"result","status":"success"}`,
			},
			text: "前半後半", session: "gemini-session",
		},
		{
			name: "Antigravity", decoder: &antigravityProtocol{tools: map[int]streamedTool{}},
			lines: []string{
				`{"event":"init","conversation_id":"agy-session","init":{"permission_mode":"request-review"}}`,
				`{"event":"step_update","step_update":{"conversation_id":"agy-session","step_index":2,"state":"ACTIVE","step_type":"agent_response","text_delta":"前半"}}`,
				`{"event":"step_update","step_update":{"conversation_id":"agy-session","step_index":2,"state":"DONE","step_type":"agent_response","text_delta":"後半"}}`,
				`{"event":"result","result":{"conversation_id":"agy-session","status":"SUCCESS","response":"前半後半"}}`,
			},
			text: "前半後半", session: "agy-session",
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			reply, err, _ := decodeProtocol(test.decoder, test.lines...)
			if err != nil || reply.Text != test.text || reply.SessionID != test.session {
				t.Fatalf("unexpected reply: %#v, %v", reply, err)
			}
		})
	}
}

func TestProviderProtocolErrors(t *testing.T) {
	tests := []struct {
		name    string
		decoder protocolDecoder
		line    string
		want    string
	}{
		{"Claude Code", &claudeProtocol{tools: map[string]streamedTool{}}, `{"type":"result","is_error":true,"result":"額度不足"}`, "額度不足"},
		{"Codex", &codexProtocol{tools: map[string]streamedTool{}}, `{"type":"turn.failed","error":{"message":"模型失敗"}}`, "模型失敗"},
		{"Grok Build", &grokProtocol{tools: map[string]streamedTool{}}, `{"type":"error","message":"未登入"}`, "未登入"},
		{"Gemini CLI", &geminiProtocol{tools: map[string]streamedTool{}}, `{"type":"result","status":"error","error":{"message":"額度不足"}}`, "額度不足"},
		{"Antigravity", &antigravityProtocol{tools: map[int]streamedTool{}}, `{"event":"result","result":{"status":"ERROR","error":"額度不足"}}`, "額度不足"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			_, err, _ := decodeProtocol(test.decoder, test.line)
			if err == nil || err.Error() != test.want {
				t.Fatalf("structured error was not preserved: %v", err)
			}
		})
	}
}

func TestProviderProtocolsRequireTerminalEvent(t *testing.T) {
	tests := []struct {
		name    string
		decoder protocolDecoder
		line    string
	}{
		{"Claude Code", &claudeProtocol{tools: map[string]streamedTool{}}, `{"type":"assistant"}`},
		{"Codex", &codexProtocol{tools: map[string]streamedTool{}}, `{"type":"item.completed","item":{"type":"agent_message","text":"尚未完成"}}`},
		{"Grok Build", &grokProtocol{tools: map[string]streamedTool{}}, `{"type":"text","data":"尚未完成"}`},
		{"Gemini CLI", &geminiProtocol{tools: map[string]streamedTool{}}, `{"type":"message","role":"assistant","content":"尚未完成","delta":true}`},
		{"Antigravity", &antigravityProtocol{tools: map[int]streamedTool{}}, `{"event":"step_update","step_update":{"step_type":"agent_response","text_delta":"尚未完成"}}`},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			_, err, _ := decodeProtocol(test.decoder, test.line)
			if err == nil || err.Error() != "Agent 輸出結束前沒有送出終局事件" {
				t.Fatalf("missing terminal event was not rejected: %v", err)
			}
		})
	}
}

func TestProviderProtocolsDoNotCountFailedToolsAsCompleted(t *testing.T) {
	tests := []struct {
		name    string
		decoder protocolDecoder
		lines   []string
	}{
		{
			"Claude Code", &claudeProtocol{tools: map[string]streamedTool{}}, []string{
				`{"type":"assistant","message":{"content":[{"type":"tool_use","id":"tool-1","name":"storyteller_upsert_lore"}]}}`,
				`{"type":"user","message":{"content":[{"type":"tool_result","tool_use_id":"tool-1","is_error":true}]}}`,
			},
		},
		{
			"Codex", &codexProtocol{tools: map[string]streamedTool{}}, []string{
				`{"type":"item.started","item":{"id":"tool-1","type":"mcp_tool_call","server":"SteamLoom","tool":"storyteller_upsert_lore"}}`,
				`{"type":"item.completed","item":{"id":"tool-1","type":"mcp_tool_call","status":"failed"}}`,
			},
		},
		{
			"Grok Build", &grokProtocol{tools: map[string]streamedTool{}}, []string{
				`{"update":{"sessionUpdate":"tool_call","toolCallId":"tool-1","title":"storyteller_upsert_lore"}}`,
				`{"update":{"sessionUpdate":"tool_call_update","toolCallId":"tool-1","status":"failed"}}`,
			},
		},
		{
			"Gemini CLI", &geminiProtocol{tools: map[string]streamedTool{}}, []string{
				`{"type":"tool_use","tool_id":"tool-1","tool_name":"storyteller_upsert_lore"}`,
				`{"type":"tool_result","tool_id":"tool-1","status":"error"}`,
			},
		},
		{
			"Antigravity", &antigravityProtocol{tools: map[int]streamedTool{}}, []string{
				`{"event":"step_update","step_update":{"step_index":1,"state":"ACTIVE","step_type":"tool","tool_name":"storyteller_upsert_lore"}}`,
				`{"event":"step_update","step_update":{"step_index":1,"state":"DONE","step_type":"tool","tool_name":"storyteller_upsert_lore","tool_info":{"error":{"message":"denied"}}}}`,
			},
		},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			var events []StreamEvent
			state := newProtocolState("", func(event StreamEvent) { events = append(events, event) })
			for _, line := range test.lines {
				state.Consume(test.decoder.Decode(line))
			}
			if len(events) != 2 || events[1].Type != StreamToolFailed {
				t.Fatalf("failed tool lifecycle was not preserved: %#v", events)
			}
		})
	}
}

func TestCodexProtocolSeparatesProgressFromFinalMessage(t *testing.T) {
	decoder := &codexProtocol{tools: map[string]streamedTool{}}
	lines := []string{
		`{"type":"item.started","item":{"id":"tool-1","type":"mcp_tool_call","server":"SteamLoom","tool":"storyteller_get_story","arguments":{"story_public_id":"story-id"}}}`,
		`{"type":"item.completed","item":{"id":"tool-1","type":"mcp_tool_call"}}`,
		`{"type":"item.completed","item":{"type":"agent_message","text":"先讀取設定"}}`,
		`{"type":"item.completed","item":{"type":"agent_message","text":"正式回答"}}`,
		`{"type":"turn.completed"}`,
	}
	reply, err, events := decodeProtocol(decoder, lines...)
	if err != nil || reply.Text != "正式回答" {
		t.Fatalf("unexpected reply: %#v, %v", reply, err)
	}
	if len(events) != 6 || events[0].ToolName != "SteamLoom.storyteller_get_story" || events[0].ToolTarget != "story-id" ||
		events[2].Type != StreamAgentPreview || events[3].Type != StreamAgentProgress || events[3].Text != "先讀取設定" ||
		events[4].Type != StreamAgentPreview || events[4].Text != "正式回答" || events[5].Text != "" {
		t.Fatalf("unexpected Codex stream events: %#v", events)
	}
}

func TestGrokAuthenticationRetryFailsFast(t *testing.T) {
	line := `{"type":"retry_state","attempt":1,"maxRetries":50,"reason":"Re-authenticating after 401 (request carried no credential); retrying request"}`
	_, err, _ := decodeProtocol(&grokProtocol{tools: map[string]streamedTool{}}, line)
	if err == nil || err.Error() != grokLoginError {
		t.Fatalf("unexpected Grok authentication error: %v", err)
	}
	legacy := `{"update":{"sessionUpdate":"retry_state","reason":"Re-authenticating after 401 (request carried no credential); retrying request"}}`
	_, err, _ = decodeProtocol(&grokProtocol{tools: map[string]streamedTool{}}, legacy)
	if err == nil || err.Error() != grokLoginError {
		t.Fatalf("legacy Grok authentication retry must stop immediately: %v", err)
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
