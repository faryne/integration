// Package skillupdate 負責替本機 AI CLI 安裝與更新 SteamLoom Skill。
// 只在使用者於「AI 助理」選擇工具時，由 MCP 檢查之後呼叫（app.go 的 EnsureSkill）；Writer 啟動時不會碰使用者的 skills 目錄。
package skillupdate

import (
	"bufio"
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
	"time"

	"github.com/Masterminds/semver/v3"
)

const maxSkillSize = 2 << 20

type Service struct {
	url     string
	client  *http.Client
	homeDir func() (string, error)
	mu      sync.Mutex
}

func New(url string) *Service {
	return &Service{
		url:     url,
		client:  &http.Client{Timeout: 30 * time.Second},
		homeDir: os.UserHomeDir,
	}
}

// Result 是一次檢查的結果；Updated 為 true 代表這次剛安裝或覆蓋了 SKILL.md。
type Result struct {
	Version string `json:"version"`
	Updated bool   `json:"updated"`
}

// Ensure 替 agentID 指定的工具安裝或更新 Skill：本機沒有就安裝，遠端版本較新才覆蓋（不降版）。
// 遠端內容會先驗證名稱、semver 與大小，絕不執行下載內容。
func (s *Service) Ensure(ctx context.Context, agentID string) (Result, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	home, err := s.homeDir()
	if err != nil {
		return Result{}, fmt.Errorf("找不到使用者目錄：%w", err)
	}
	dir, err := skillsDir(agentID, home)
	if err != nil {
		return Result{}, err
	}
	content, latest, err := s.download(ctx)
	if err != nil {
		return Result{}, err
	}
	updated, err := install(dir, content, latest)
	if err != nil {
		return Result{}, fmt.Errorf("安裝 SteamLoom Skill 失敗：%w", err)
	}
	return Result{Version: latest.Original(), Updated: updated}, nil
}

// skillsDir 回傳各家 CLI 官方使用者層級 Skill 目錄。
func skillsDir(agentID, home string) (string, error) {
	switch agentID {
	case "claude":
		return filepath.Join(home, ".claude", "skills"), nil
	case "codex":
		return filepath.Join(home, ".agents", "skills"), nil
	case "grok":
		return filepath.Join(home, ".grok", "skills"), nil
	case "gemini":
		return filepath.Join(home, ".gemini", "skills"), nil
	case "antigravity":
		return filepath.Join(home, ".gemini", "antigravity-cli", "skills"), nil
	}
	return "", errors.New("不支援的 AI Agent")
}

func (s *Service) download(ctx context.Context) ([]byte, *semver.Version, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.url, nil)
	if err != nil {
		return nil, nil, fmt.Errorf("建立 Skill 更新請求失敗：%w", err)
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return nil, nil, fmt.Errorf("下載 SteamLoom Skill 失敗：%w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, nil, fmt.Errorf("下載 SteamLoom Skill 失敗（HTTP %d）", resp.StatusCode)
	}
	content, err := io.ReadAll(io.LimitReader(resp.Body, maxSkillSize+1))
	if err != nil {
		return nil, nil, fmt.Errorf("讀取 SteamLoom Skill 失敗：%w", err)
	}
	if len(content) > maxSkillSize {
		return nil, nil, fmt.Errorf("SteamLoom Skill 超過 %d MiB 上限", maxSkillSize>>20)
	}
	name, version := metadata(content)
	if name != "steamloom" || version == "" {
		return nil, nil, fmt.Errorf("下載內容不是有效的 SteamLoom Skill")
	}
	parsed, err := semver.NewVersion(version)
	if err != nil {
		return nil, nil, fmt.Errorf("SteamLoom Skill 版號無效：%s", version)
	}
	return content, parsed, nil
}

// install 回傳是否真的寫入；本機版本不比遠端舊就保留原檔，只順手清掉已驗證的舊版。
func install(skillsDir string, content []byte, latest *semver.Version) (bool, error) {
	dir := filepath.Join(skillsDir, "steamloom")
	path := filepath.Join(dir, "SKILL.md")
	if current, err := os.ReadFile(path); err == nil {
		_, currentVersion := metadata(current)
		if parsed, err := semver.NewVersion(currentVersion); err == nil && !latest.GreaterThan(parsed) {
			return false, removeLegacy(skillsDir)
		}
	} else if !os.IsNotExist(err) {
		return false, err
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return false, err
	}
	if err := replaceFile(path, content); err != nil {
		return false, err
	}
	return true, removeLegacy(skillsDir)
}

// replaceFile 先在同目錄寫完整暫存檔再替換；Windows 不允許 rename 覆蓋，需先移除舊檔。
func replaceFile(path string, content []byte) error {
	tmp, err := os.CreateTemp(filepath.Dir(path), ".SKILL.md-*")
	if err != nil {
		return err
	}
	tmpPath := tmp.Name()
	defer os.Remove(tmpPath)
	if err := tmp.Chmod(0o644); err != nil {
		tmp.Close()
		return err
	}
	if _, err := tmp.Write(content); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if runtime.GOOS == "windows" {
		if err := os.Remove(path); err != nil && !os.IsNotExist(err) {
			return err
		}
	}
	return os.Rename(tmpPath, path)
}

// removeLegacy 僅刪除 frontmatter 明確標成舊 SteamLoom 名稱的 skill，避免碰到同名私人資料。
func removeLegacy(skillsDir string) error {
	dir := filepath.Join(skillsDir, "storyteller-mcp")
	content, err := os.ReadFile(filepath.Join(dir, "SKILL.md"))
	if os.IsNotExist(err) {
		return nil
	}
	if err != nil {
		return err
	}
	name, _ := metadata(content)
	if name != "storyteller-mcp" {
		return nil
	}
	return os.RemoveAll(dir)
}

// metadata 只讀 YAML frontmatter 內需要的兩個欄位，避免把整份 markdown 當設定檔解析。
func metadata(content []byte) (name, version string) {
	scanner := bufio.NewScanner(bytes.NewReader(content))
	if !scanner.Scan() || strings.TrimSpace(scanner.Text()) != "---" {
		return "", ""
	}
	for scanner.Scan() {
		line := scanner.Text()
		if strings.TrimSpace(line) == "---" {
			break
		}
		if strings.HasPrefix(line, "name:") {
			name = strings.Trim(strings.TrimSpace(strings.TrimPrefix(line, "name:")), `"'`)
		}
		if strings.HasPrefix(line, "  version:") {
			version = strings.Trim(strings.TrimSpace(strings.TrimPrefix(line, "  version:")), `"'`)
		}
	}
	return name, version
}
