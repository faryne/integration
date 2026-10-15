package agent

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestMCPServerFindsClaudeServerName(t *testing.T) {
	home := t.TempDir()
	config := `{"mcpServers":{"Other":{"url":"https://example.com/mcp"},"My SteamLoom":{"url":"https://steamloom.works/mcp/"}}}`
	if err := os.WriteFile(filepath.Join(home, ".claude.json"), []byte(config), 0o600); err != nil {
		t.Fatal(err)
	}
	name, installed, err := mcpServer("claude", home)
	if err != nil || !installed || name != "My SteamLoom" {
		t.Fatalf("unexpected Claude MCP result: %q, %v, %v", name, installed, err)
	}
}

func TestMCPServerIgnoresClaudeProjectLocalConfig(t *testing.T) {
	home := t.TempDir()
	config := `{"projects":{"/another/project":{"mcpServers":{"SteamLoom":{"url":"https://steamloom.works/mcp"}}}}}`
	if err := os.WriteFile(filepath.Join(home, ".claude.json"), []byte(config), 0o600); err != nil {
		t.Fatal(err)
	}
	if name, installed, err := mcpServer("claude", home); err != nil || installed || name != "" {
		t.Fatalf("project-local MCP must not leak into Writer sessions: %q, %v, %v", name, installed, err)
	}
}

func TestMCPServerFindsQuotedTOMLServerName(t *testing.T) {
	home := t.TempDir()
	dir := filepath.Join(home, ".codex")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		t.Fatal(err)
	}
	config := "[mcp_servers.\"Steam.Loom\"]\nurl = \"https://steamloom.works/mcp\"\n[mcp_servers.\"Steam.Loom\".headers]\nurl = \"https://example.com/not-the-server\"\n"
	if err := os.WriteFile(filepath.Join(dir, "config.toml"), []byte(config), 0o600); err != nil {
		t.Fatal(err)
	}
	name, installed, err := mcpServer("codex", home)
	if err != nil || !installed || name != "Steam.Loom" {
		t.Fatalf("unexpected Codex MCP result: %q, %v, %v", name, installed, err)
	}
}

func TestMCPServerFindsGeminiAndAntigravityJSONConfigs(t *testing.T) {
	home := t.TempDir()
	configs := []struct {
		agent string
		path  string
		body  string
	}{
		{"gemini", filepath.Join(home, ".gemini", "settings.json"), `{"mcpServers":{"Gemini SteamLoom":{"httpUrl":"https://steamloom.works/mcp"}}}`},
		{"antigravity", filepath.Join(home, ".gemini", "config", "mcp_config.json"), `{"mcpServers":{"Antigravity SteamLoom":{"serverUrl":"https://steamloom.works/mcp/"}}}`},
	}
	for _, config := range configs {
		if err := os.MkdirAll(filepath.Dir(config.path), 0o700); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(config.path, []byte(config.body), 0o600); err != nil {
			t.Fatal(err)
		}
		name, installed, err := mcpServer(config.agent, home)
		if err != nil || !installed || !strings.Contains(name, "SteamLoom") {
			t.Fatalf("unexpected %s MCP result: %q, %v, %v", config.agent, name, installed, err)
		}
	}
}

func TestGeminiMCPInstallCommandRestrictsTools(t *testing.T) {
	command := mcpInstallCommand("gemini")
	if !strings.Contains(command, "--transport http --scope user --include-tools") || !strings.Contains(command, "storyteller_get_story") || strings.Contains(command, "upsert") {
		t.Fatalf("Gemini MCP install command must include only read tools: %s", command)
	}
}

func TestWriterReadOnlyToolsContainNoMutation(t *testing.T) {
	for _, name := range writerReadOnlyTools {
		for _, mutation := range []string{"upsert", "patch", "replace", "move", "delete", "revert", "upload", "presign", "confirm"} {
			if strings.Contains(name, mutation) {
				t.Fatalf("mutation tool leaked into Writer draft allowlist: %s", name)
			}
		}
	}
}
