// Package skillupdate 負責替本機 Claude Code／Codex 更新 SteamLoom Skill。
package skillupdate

import (
	"bufio"
	"bytes"
	"context"
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

// Update 只在偵測到對應工具時下載並更新；遠端內容會先驗證名稱與 semver，絕不執行下載內容。
func (s *Service) Update(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()

	home, err := s.homeDir()
	if err != nil {
		return fmt.Errorf("找不到使用者目錄：%w", err)
	}
	targets := detectedTargets(home)
	if len(targets) == 0 {
		return nil
	}

	content, latest, err := s.download(ctx)
	if err != nil {
		return err
	}
	for _, target := range targets {
		if err := install(target, content, latest); err != nil {
			return fmt.Errorf("更新 %s 的 SteamLoom Skill 失敗：%w", target.label, err)
		}
	}
	return nil
}

type target struct {
	label     string
	skillsDir string
}

func detectedTargets(home string) []target {
	var targets []target
	if isDir(filepath.Join(home, ".claude")) {
		targets = append(targets, target{"Claude Code", filepath.Join(home, ".claude", "skills")})
	}
	if isDir(filepath.Join(home, ".codex")) || isDir(filepath.Join(home, ".agents")) {
		targets = append(targets, target{"Codex", filepath.Join(home, ".agents", "skills")})
	}
	return targets
}

func isDir(path string) bool {
	info, err := os.Stat(path)
	return err == nil && info.IsDir()
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

func install(target target, content []byte, latest *semver.Version) error {
	dir := filepath.Join(target.skillsDir, "steamloom")
	path := filepath.Join(dir, "SKILL.md")
	if current, err := os.ReadFile(path); err == nil {
		_, currentVersion := metadata(current)
		if parsed, err := semver.NewVersion(currentVersion); err == nil && !latest.GreaterThan(parsed) {
			return removeLegacy(target.skillsDir)
		}
	} else if !os.IsNotExist(err) {
		return err
	}
	if err := os.MkdirAll(dir, 0o755); err != nil {
		return err
	}
	if err := replaceFile(path, content); err != nil {
		return err
	}
	return removeLegacy(target.skillsDir)
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
