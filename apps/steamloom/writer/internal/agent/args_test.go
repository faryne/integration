package agent

import (
	"path/filepath"
	"slices"
	"strings"
	"testing"
)

func TestCodexArgsKeepNewAndResumedSessionsReadOnly(t *testing.T) {
	newArgs := codexArgs("", "/tmp/writer", "")
	if !slices.Contains(newArgs, "read-only") || !slices.Contains(newArgs, "/tmp/writer") {
		t.Fatalf("new Codex session must be read-only and use Writer cwd: %v", newArgs)
	}

	resumed := codexArgs("session-id", "/tmp/writer", "")
	if !slices.Contains(resumed, `sandbox_mode="read-only"`) || !slices.Contains(resumed, "session-id") {
		t.Fatalf("resumed Codex session must keep the read-only override: %v", resumed)
	}
}

func TestClaudeArgsDisableToolsAndUserMCP(t *testing.T) {
	args := claudeArgs("session-id", "")
	if !containsPair(args, "--output-format", "stream-json") || !slices.Contains(args, "--include-partial-messages") || !containsPair(args, "--tools", "") || !slices.Contains(args, "--strict-mcp-config") || !containsPair(args, "--resume", "session-id") {
		t.Fatalf("Claude chat mode must stay tool-free and resume the requested session: %v", args)
	}
}

func TestGrokArgsDisableAutoUpdateAndTools(t *testing.T) {
	args := grokArgs("session-id", "/tmp/writer", "/tmp/writer/prompt.txt", "")
	for _, flag := range []string{"--no-auto-update", "--disable-web-search", "--no-subagents"} {
		if !slices.Contains(args, flag) {
			t.Fatalf("Grok args missing %s: %v", flag, args)
		}
	}
	if !containsPair(args, "--tools", "") || !containsPair(args, "--permission-mode", "dontAsk") || !containsPair(args, "--max-turns", "12") || !containsPair(args, "--resume", "session-id") {
		t.Fatalf("Grok chat mode must stay tool-free and resume the requested session: %v", args)
	}
	if !containsPair(args, "--output-format", "streaming-json") {
		t.Fatalf("Grok chat mode must emit streaming JSON: %v", args)
	}
}

func TestProviderArgsExposeOnlySteamLoomReadTools(t *testing.T) {
	claudeCLIArgs := claudeArgs("", "SteamLoom")
	claude := strings.Join(claudeCLIArgs, " ")
	if !containsPair(claudeCLIArgs, "--tools", "") || !strings.Contains(claude, "mcp__SteamLoom__storyteller_get_story") || strings.Contains(claude, "upsert") {
		t.Fatalf("Claude must receive only the Writer read allowlist: %s", claude)
	}

	codex := strings.Join(codexArgs("", "/tmp/writer", "SteamLoom"), " ")
	if !strings.Contains(codex, `mcp_servers.SteamLoom.enabled_tools=`) || strings.Contains(codex, `mcp_servers."SteamLoom"`) || !strings.Contains(codex, "storyteller_get_story") || strings.Contains(codex, "upsert") {
		t.Fatalf("Codex must receive only the Writer read allowlist: %s", codex)
	}

	grok := strings.Join(grokArgs("", "/tmp/writer", "/tmp/writer/prompt.txt", "SteamLoom"), " ")
	if !strings.Contains(grok, "MCPTool(SteamLoom__storyteller_get_story)") || strings.Contains(grok, "upsert") {
		t.Fatalf("Grok must receive only the Writer read allowlist: %s", grok)
	}
}

func TestProviderArgsExposeOnlyApprovedMutationTools(t *testing.T) {
	tools := []string{"storyteller_upsert_lore"}
	claude := strings.Join(claudeArgsWithGrant("session", "SteamLoom", tools), " ")
	codex := strings.Join(codexArgsWithTools("session", "/tmp/writer", "SteamLoom", tools), " ")
	grok := strings.Join(grokArgsWithTools("session", "/tmp/writer", "/tmp/writer/prompt.txt", "SteamLoom", tools), " ")
	for name, args := range map[string]string{"claude": claude, "codex": codex, "grok": grok} {
		if !strings.Contains(args, "storyteller_upsert_lore") || strings.Contains(args, "storyteller_get_story") || strings.Contains(args, "storyteller_delete") {
			t.Fatalf("%s apply tools escaped the approval grant: %s", name, args)
		}
	}
}

func TestProviderArgsAddAssetMCPWithoutShell(t *testing.T) {
	invocation := &assetMCPInvocation{Command: "/Applications/SteamLoom Writer", Args: []string{"--asset-mcp", "grok", "project", "thread", "proposal", "grant"}}
	grant := &ApprovalGrant{Tools: []string{"storyteller_presign_asset_upload", "storyteller_confirm_asset_upload"}, assetMCP: invocation}
	req := Request{SessionID: "session", mcpServer: "SteamLoom", grant: grant}
	claude := strings.Join(claudeRequestArgs(req), " ")
	codexArgs, err := codexRequestArgs(req, "/tmp/writer")
	if err != nil {
		t.Fatal(err)
	}
	codex := strings.Join(codexArgs, " ")
	dir := t.TempDir()
	grokArgs, err := grokRequestArgs(req, dir, filepath.Join(dir, "prompt.txt"))
	if err != nil {
		t.Fatal(err)
	}
	grok := strings.Join(grokArgs, " ")
	for name, args := range map[string]string{"claude": claude, "codex": codex, "grok": grok} {
		if !strings.Contains(args, assetMCPToolName) || strings.Contains(args, "Bash(") || strings.Contains(args, "network_access=true") {
			t.Fatalf("%s asset grant is not narrowly scoped: %s", name, args)
		}
	}
}

func TestCodexRejectsMCPNameThatCannotBeOverriddenSafely(t *testing.T) {
	_, err := codexRequestArgs(Request{mcpServer: "Steam.Loom"}, "/tmp/writer")
	if err == nil || !strings.Contains(err.Error(), "英數字") {
		t.Fatalf("Codex must reject MCP names that require a quoted dotted key: %v", err)
	}
}

func TestRequestBodyDelegatesSteamLoomReadToAgent(t *testing.T) {
	body := (Request{ProjectID: "project-123", Title: "測試作品", Prompt: "檢查角色設定", mcpServer: "SteamLoom"}).body()
	for _, want := range []string{"project_public_id: project-123", "你可以使用這輪提供的 SteamLoom 唯讀與內容驗證工具", "尚未寫入 SteamLoom"} {
		if !strings.Contains(body, want) {
			t.Fatalf("Agent prompt missing %q: %s", want, body)
		}
	}
	for _, forbidden := range []string{"Writer 會讀取", "Writer 會轉送", "Writer 代為寫入"} {
		if strings.Contains(body, forbidden) {
			t.Fatalf("Writer must stay outside the MCP data path: %s", body)
		}
	}
	for _, want := range []string{proposalEnvelopeStart, "proposal 只是本機待確認資料", "不得呼叫任何寫入工具"} {
		if !strings.Contains(body, want) {
			t.Fatalf("Agent prompt missing proposal boundary %q: %s", want, body)
		}
	}
}

func TestRequestBodyDelegatesNamedReferenceResolutionToAgent(t *testing.T) {
	body := (Request{ProjectID: "project-123", Title: "測試作品", Prompt: "比較 @story:[第一話] 與 @lore:[角色 A]", mcpServer: "SteamLoom"}).body()
	for _, want := range []string{"storyteller_list_stories", "storyteller_get_story", "storyteller_list_lores", "storyteller_get_lore", "依完整標題定位", "Writer 沒有附上引用內容"} {
		if !strings.Contains(body, want) {
			t.Fatalf("named reference prompt missing %q: %s", want, body)
		}
	}
	if strings.Contains((Request{Prompt: "檢查 @thisStory"}).referenceRules(), "storyteller_get_story") {
		t.Fatal("project-level Writer must not treat @thisStory as a supported reference")
	}
}

func containsPair(values []string, key, value string) bool {
	for i := 0; i+1 < len(values); i++ {
		if values[i] == key && values[i+1] == value {
			return true
		}
	}
	return false
}
