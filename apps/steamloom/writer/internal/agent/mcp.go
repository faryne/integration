package agent

import (
	"encoding/json"
	"errors"
	"net/url"
	"os"
	"path/filepath"
	"strings"
)

// 安裝提示用的名稱。偵測不看這個名字，只看位址；使用者自己取的名字不用管。
const steamLoomMCPName = "SteamLoom"
const steamLoomMCPURL = "https://steamloom.works/mcp"

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
	switch agentID {
	case "claude":
		return claudeHasMCP(home)
	case "codex":
		return tomlHasMCP(filepath.Join(home, ".codex", "config.toml"))
	case "grok":
		return tomlHasMCP(filepath.Join(home, ".grok", "config.toml"))
	default:
		return false, errors.New("不支援的 AI Agent")
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
	URL string `json:"url"`
}

func claudeHasMCP(home string) (bool, error) {
	data, err := os.ReadFile(filepath.Join(home, ".claude.json"))
	if errors.Is(err, os.ErrNotExist) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	var cfg struct {
		McpServers map[string]mcpURL `json:"mcpServers"`
		Projects   map[string]struct {
			McpServers map[string]mcpURL `json:"mcpServers"`
		} `json:"projects"`
	}
	if err := json.Unmarshal(data, &cfg); err != nil {
		return false, err
	}
	if urlsHaveMCP(cfg.McpServers) {
		return true, nil
	}
	for _, project := range cfg.Projects {
		if urlsHaveMCP(project.McpServers) {
			return true, nil
		}
	}
	return false, nil
}

func urlsHaveMCP(servers map[string]mcpURL) bool {
	for _, server := range servers {
		if sameSteamLoomMCP(server.URL) {
			return true
		}
	}
	return false
}

func tomlHasMCP(path string) (bool, error) {
	data, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return false, nil
	}
	if err != nil {
		return false, err
	}
	inServer := false
	for _, line := range strings.Split(string(data), "\n") {
		trim := strings.TrimSpace(line)
		if trim == "" || strings.HasPrefix(trim, "#") {
			continue
		}
		if strings.HasPrefix(trim, "[") {
			// [mcp_servers.名稱] 才算；[mcp_servers.名稱.headers] 裡的 url 不是連線位址。
			header := strings.Trim(trim, "[]")
			name, ok := strings.CutPrefix(header, "mcp_servers.")
			inServer = ok && name != "" && !strings.Contains(name, ".")
			continue
		}
		if !inServer {
			continue
		}
		key, value, ok := strings.Cut(trim, "=")
		if !ok || strings.TrimSpace(key) != "url" {
			continue
		}
		if sameSteamLoomMCP(tomlString(value)) {
			return true, nil
		}
	}
	return false, nil
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
