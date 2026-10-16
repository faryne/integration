package agent

import (
	"context"
	"errors"
	"runtime"
	"testing"
	"time"
)

func TestClaudeInitReportsSteamLoomMCPUnavailable(t *testing.T) {
	cases := map[string]bool{"needs-auth": true, "failed": false}
	for status, auth := range cases {
		state := newProtocolState("", nil)
		decoder := &claudeProtocol{tools: map[string]streamedTool{}, server: "storyteller"}
		line := `{"type":"system","subtype":"init","session_id":"s1","mcp_servers":[{"name":"other","status":"failed"},{"name":"storyteller","status":"` + status + `"}]}`
		if !state.Consume(decoder.Decode(line)) {
			t.Fatalf("%s must stop the turn", status)
		}
		_, err := state.Reply()
		var unavailable *MCPUnavailableError
		if !errors.As(err, &unavailable) || unavailable.Server != "storyteller" || unavailable.AuthRequired != auth {
			t.Fatalf("%s: unexpected error %#v", status, err)
		}
	}
	// 其他 server 失敗、或 SteamLoom 已連線時不影響這輪。
	decoder := &claudeProtocol{tools: map[string]streamedTool{}, server: "storyteller"}
	for _, line := range []string{
		`{"type":"system","subtype":"init","mcp_servers":[{"name":"other","status":"needs-auth"}]}`,
		`{"type":"system","subtype":"init","mcp_servers":[{"name":"storyteller","status":"connected"}]}`,
	} {
		for _, event := range decoder.Decode(line) {
			if event.Type == protocolMCPUnavailable {
				t.Fatalf("unexpected MCP failure for %s", line)
			}
		}
	}
}

func TestCodexStderrReportsSteamLoomAuthRequired(t *testing.T) {
	decoder := &codexProtocol{tools: map[string]streamedTool{}, server: "storyteller"}
	line := `ERROR rmcp::transport::worker: worker quit with fatal: Transport channel closed, when AuthRequired(AuthRequiredError { www_authenticate_header: "Bearer resource_metadata=\"https://steamloom.works/.well-known/oauth-protected-resource\", error=\"invalid_token\"" })`
	events := decoder.DecodeStderr(line)
	if len(events) != 1 || events[0].Type != protocolMCPUnavailable || events[0].Server != "storyteller" || events[0].Text != "auth" {
		t.Fatalf("unexpected events: %#v", events)
	}
	if events := decoder.DecodeStderr(`ERROR rmcp: AuthRequired(https://example.com/.well-known)`); len(events) != 0 {
		t.Fatalf("other MCP servers must not stop the turn: %#v", events)
	}
}

func TestMCPUnavailableAttachesReauthCommands(t *testing.T) {
	action, commands := failureAction("codex", &MCPUnavailableError{AgentID: "codex", Server: "storyteller", AuthRequired: true})
	if action != "mcp.login" || len(commands) != 1 || commands[0] != "codex mcp login storyteller" {
		t.Fatalf("unexpected action: %s %v", action, commands)
	}
	if commands := (&MCPUnavailableError{AgentID: "claude", Server: "Steam Loom"}).Commands(); commands[0] != `claude mcp login "Steam Loom"` {
		t.Fatalf("server names with spaces must be quoted: %v", commands)
	}
}

func TestRunStopsAsSoonAsStderrReportsFailure(t *testing.T) {
	if runtime.GOOS == "windows" {
		t.Skip("uses sh")
	}
	started := time.Now()
	_, _ = run(context.Background(), "probe", "sh", t.TempDir(), []string{"-c", "echo 'AuthRequired steamloom.works' >&2; sleep 5; echo late"}, "", nil, func(line string) bool {
		return codexMCPAuthRequired(line)
	})
	if elapsed := time.Since(started); elapsed > 3*time.Second {
		t.Fatalf("process was not stopped by stderr signal: %s", elapsed)
	}
}
