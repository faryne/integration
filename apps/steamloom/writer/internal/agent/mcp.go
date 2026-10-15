package agent

import (
	"encoding/json"
	"errors"
	"net/url"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
)

// 安裝提示用的名稱。偵測不看這個名字，只看位址；使用者自己取的名字不用管。
const steamLoomMCPName = "SteamLoom"
const steamLoomMCPURL = "https://steamloom.works/mcp"

// writerReadOnlyTools 是 draft turn 唯一會被自動核准的 SteamLoom 工具；任何 mutation 都不在清單內。
var writerReadOnlyTools = []string{
	"storyteller_get_project",
	"storyteller_list_stories", "storyteller_get_story", "storyteller_list_story_versions", "storyteller_get_story_version",
	"storyteller_list_story_chapters", "storyteller_get_story_chapter", "storyteller_get_story_chapters", "storyteller_list_volumes",
	"storyteller_list_lores", "storyteller_get_lore", "storyteller_list_lore_versions", "storyteller_get_lore_version",
	"storyteller_list_lore_collections", "storyteller_list_lore_chapters", "storyteller_get_lore_chapter", "storyteller_get_lore_chapters",
	"storyteller_list_assets", "storyteller_get_asset", "storyteller_list_asset_collections",
	"storyteller_search_project", "storyteller_list_memories", "storyteller_search_memories", "storyteller_list_profiles",
	"storyteller_validate_content",
}

// McpHint 是對話區要不要提示安裝。Command 是給使用者自己貼到終端機的指令，Writer 不執行。
type McpHint struct {
	Installed bool   `json:"installed"`
	Command   string `json:"command"`
}

// McpHintFor 看這個 Agent 的使用者設定裡有沒有 SteamLoom 的 MCP 位址。
// 任何名稱只要位址相同就算已安裝，不提示。設定檔不存在當成沒安裝。
func McpHintFor(agentID string) (McpHint, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return McpHint{}, err
	}
	return mcpHint(agentID, home)
}

func mcpHint(agentID, home string) (McpHint, error) {
	installed, err := mcpInstalled(agentID, home)
	if err != nil {
		return McpHint{}, err
	}
	hint := McpHint{Installed: installed}
	if !installed {
		hint.Command = mcpInstallCommand(agentID)
	}
	return hint, nil
}

func mcpInstalled(agentID, home string) (bool, error) {
	_, installed, err := mcpServer(agentID, home)
	return installed, err
}

func mcpServer(agentID, home string) (string, bool, error) {
	switch agentID {
	case "claude":
		return claudeMCPServer(home)
	case "codex":
		return tomlMCPServer(filepath.Join(home, ".codex", "config.toml"))
	case "grok":
		return tomlMCPServer(filepath.Join(home, ".grok", "config.toml"))
	case "gemini":
		return jsonMCPServer(filepath.Join(home, ".gemini", "settings.json"))
	case "antigravity":
		return jsonMCPServer(filepath.Join(home, ".gemini", "config", "mcp_config.json"))
	default:
		return "", false, errors.New("不支援的 AI Agent")
	}
}

func mcpInstallCommand(agentID string) string {
	switch agentID {
	case "claude":
		// 預設 scope 是 local，只對當時那個目錄有效；提示改成 user，之後在哪裡開 CLI 都找得到。
		return "claude mcp add --transport http --scope user " + steamLoomMCPName + " " + steamLoomMCPURL + "\n" +
			"claude mcp login " + steamLoomMCPName
	case "codex":
		return "codex mcp add " + steamLoomMCPName + " --url " + steamLoomMCPURL + "\n" +
			"codex mcp login " + steamLoomMCPName
	case "grok":
		return "grok mcp add --transport http --scope user " + steamLoomMCPName + " " + steamLoomMCPURL
	case "gemini":
		return "gemini mcp add --transport http --scope user --include-tools " + strings.Join(writerReadOnlyTools, ",") + " " + steamLoomMCPName + " " + steamLoomMCPURL
	case "antigravity":
		// Antigravity 目前只提供互動式 /mcp 設定入口。
		return "agy"
	default:
		return ""
	}
}

// 只認 https://steamloom.works/mcp。尾端斜線不管，子路徑（例如 /mcp/skill.md）不算。
func sameSteamLoomMCP(raw string) bool {
	parsed, err := url.Parse(strings.TrimSpace(raw))
	if err != nil || parsed.Hostname() == "" {
		return false
	}
	if !strings.EqualFold(parsed.Scheme, "https") || !strings.EqualFold(parsed.Hostname(), "steamloom.works") {
		return false
	}
	if parsed.Port() != "" && parsed.Port() != "443" {
		return false
	}
	return strings.TrimSuffix(parsed.EscapedPath(), "/") == "/mcp"
}

type mcpURL struct {
	URL       string `json:"url"`
	HTTPURL   string `json:"httpUrl"`
	ServerURL string `json:"serverUrl"`
}

func claudeMCPServer(home string) (string, bool, error) {
	data, err := os.ReadFile(filepath.Join(home, ".claude.json"))
	if errors.Is(err, os.ErrNotExist) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	var cfg struct {
		McpServers map[string]mcpURL `json:"mcpServers"`
	}
	if err := json.Unmarshal(data, &cfg); err != nil {
		return "", false, err
	}
	if name := serverNameWithMCP(cfg.McpServers); name != "" {
		return name, true, nil
	}
	// Writer 的 Agent 在獨立 session 目錄執行，不能誤用只對其他專案生效的 local-scope MCP。
	return "", false, nil
}

func serverNameWithMCP(servers map[string]mcpURL) string {
	names := make([]string, 0, len(servers))
	for name, server := range servers {
		if sameSteamLoomMCP(server.URL) || sameSteamLoomMCP(server.HTTPURL) || sameSteamLoomMCP(server.ServerURL) {
			names = append(names, name)
		}
	}
	sort.Strings(names)
	if len(names) == 0 {
		return ""
	}
	return names[0]
}

func jsonMCPServer(path string) (string, bool, error) {
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	var cfg struct {
		McpServers map[string]mcpURL `json:"mcpServers"`
	}
	if err := json.Unmarshal(data, &cfg); err != nil {
		return "", false, err
	}
	name := serverNameWithMCP(cfg.McpServers)
	return name, name != "", nil
}

func tomlMCPServer(path string) (string, bool, error) {
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return "", false, nil
	}
	if err != nil {
		return "", false, err
	}
	serverName := ""
	for _, line := range strings.Split(string(data), "\n") {
		trim := strings.TrimSpace(line)
		if trim == "" || strings.HasPrefix(trim, "#") {
			continue
		}
		if strings.HasPrefix(trim, "[") {
			// [mcp_servers.名稱] 才算；[mcp_servers.名稱.headers] 裡的 url 不是連線位址。
			header := strings.Trim(trim, "[]")
			serverName = tomlMCPServerName(header)
			continue
		}
		if serverName == "" {
			continue
		}
		key, value, ok := strings.Cut(trim, "=")
		if !ok || strings.TrimSpace(key) != "url" {
			continue
		}
		if sameSteamLoomMCP(tomlString(value)) {
			return serverName, true, nil
		}
	}
	return "", false, nil
}

func tomlMCPServerName(header string) string {
	value, ok := strings.CutPrefix(strings.TrimSpace(header), "mcp_servers.")
	if !ok || value == "" {
		return ""
	}
	if value[0] == '"' {
		for i := 1; i < len(value); i++ {
			if value[i] != '"' || value[i-1] == '\\' {
				continue
			}
			if strings.TrimSpace(value[i+1:]) != "" {
				return ""
			}
			name, err := strconv.Unquote(value[:i+1])
			if err == nil {
				return name
			}
			return ""
		}
		return ""
	}
	if value[0] == '\'' {
		end := strings.IndexByte(value[1:], '\'')
		if end < 0 || strings.TrimSpace(value[end+2:]) != "" {
			return ""
		}
		return value[1 : end+1]
	}
	if strings.Contains(value, ".") {
		return ""
	}
	return strings.TrimSpace(value)
}

func tomlString(value string) string {
	text := strings.TrimSpace(value)
	if len(text) < 2 {
		return text
	}
	quote := text[0]
	if quote != '"' && quote != '\'' {
		return text
	}
	text = text[1:]
	if end := strings.IndexByte(text, quote); end >= 0 {
		return text[:end]
	}
	return text
}
