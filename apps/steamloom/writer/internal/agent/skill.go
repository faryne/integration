package agent

import (
	"context"
	"errors"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"
)

const (
	skillName   = "steamloom"
	skillLegacy = "storyteller-mcp"
	skillURL    = "https://steamloom.works/mcp/skill.md"
)

// SkillResult 是這次檢查的結果。Updated 為 true 代表剛寫入或覆蓋了 SKILL.md。
type SkillResult struct {
	Version string `json:"version"`
	Updated bool   `json:"updated"`
}

// EnsureSkill 下載最新 SKILL.md，這個 Agent 還沒有或版本不同才寫入。
// Claude Code 放 ~/.claude/skills，Codex 放 ~/.agents/skills，Grok 放 ~/.grok/skills。
func EnsureSkill(agentID string) (SkillResult, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return SkillResult{}, err
	}
	root, err := skillRoot(agentID, home)
	if err != nil {
		return SkillResult{}, err
	}
	data, version, err := downloadSkill()
	if err != nil {
		return SkillResult{}, err
	}
	dir := filepath.Join(root, skillName)
	current := skillVersion(readSkill(filepath.Join(dir, "SKILL.md")))
	updated := false
	if current != version {
		if err := writeSkill(dir, data); err != nil {
			return SkillResult{}, err
		}
		updated = true
	}
	removeLegacySkill(root)
	return SkillResult{Version: version, Updated: updated}, nil
}

func skillRoot(agentID, home string) (string, error) {
	switch agentID {
	case "claude":
		return filepath.Join(home, ".claude", "skills"), nil
	case "codex":
		return filepath.Join(home, ".agents", "skills"), nil
	case "grok":
		return filepath.Join(home, ".grok", "skills"), nil
	default:
		return "", errors.New("不支援的 AI Agent")
	}
}

func downloadSkill() ([]byte, string, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, skillURL, nil)
	if err != nil {
		return nil, "", err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, "", errors.New("下載 SKILL.md 失敗")
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, "", errors.New("下載 SKILL.md 失敗")
	}
	data, err := io.ReadAll(io.LimitReader(resp.Body, 2<<20))
	if err != nil {
		return nil, "", errors.New("下載 SKILL.md 失敗")
	}
	version := skillVersion(string(data))
	if version == "" {
		return nil, "", errors.New("下載到的檔案不是 SteamLoom Skill")
	}
	return data, version, nil
}

// 對應安裝程式讀的那一行：metadata 底下的 version: "x.y.z"。
func skillVersion(text string) string {
	const prefix = `  version: "`
	for _, line := range strings.Split(text, "\n") {
		if strings.HasPrefix(line, prefix) && strings.HasSuffix(line, `"`) && len(line) > len(prefix) {
			return strings.TrimSuffix(strings.TrimPrefix(line, prefix), `"`)
		}
	}
	return ""
}

func readSkill(path string) string {
	data, err := os.ReadFile(path)
	if err != nil {
		return ""
	}
	return string(data)
}

func writeSkill(dir string, data []byte) error {
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	target := filepath.Join(dir, "SKILL.md")
	tmp := target + ".tmp"
	if err := os.WriteFile(tmp, data, 0o644); err != nil {
		return err
	}
	_ = os.Remove(target)
	if err := os.Rename(tmp, target); err != nil {
		_ = os.Remove(tmp)
		return err
	}
	return nil
}

// 只刪確認是舊版 SteamLoom Skill 的資料夾，避免誤刪同名的其他東西。
func removeLegacySkill(root string) {
	legacy := filepath.Join(root, skillLegacy)
	text := readSkill(filepath.Join(legacy, "SKILL.md"))
	for _, line := range strings.Split(text, "\n") {
		if line == "name: "+skillLegacy {
			_ = os.RemoveAll(legacy)
			return
		}
	}
}
