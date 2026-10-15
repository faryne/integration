package skillupdate

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

// newTestService 建一個指向假 Skill 來源、home 在暫存目錄的 Service。
func newTestService(t *testing.T, body []byte) (*Service, string) {
	t.Helper()
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write(body) }))
	t.Cleanup(server.Close)
	home := t.TempDir()
	service := New(server.URL)
	service.homeDir = func() (string, error) { return home, nil }
	return service, home
}

func writeFile(t *testing.T, path string, content []byte) {
	t.Helper()
	if err := os.MkdirAll(filepath.Dir(path), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(path, content, 0o644); err != nil {
		t.Fatal(err)
	}
}

func TestEnsureInstallsForSelectedAgentAndRemovesVerifiedLegacy(t *testing.T) {
	latest := []byte("---\nname: steamloom\nmetadata:\n  version: \"2.3.0\"\n---\n\nlatest\n")
	service, home := newTestService(t, latest)
	writeFile(t, filepath.Join(home, ".agents/skills/storyteller-mcp/SKILL.md"), []byte("---\nname: storyteller-mcp\nmetadata:\n  version: \"2.0.0\"\n---\n"))

	result, err := service.Ensure(context.Background(), "codex")
	if err != nil {
		t.Fatal(err)
	}
	if !result.Updated || result.Version != "2.3.0" {
		t.Fatalf("本機沒有 Skill 時應安裝：%+v", result)
	}
	if content, err := os.ReadFile(filepath.Join(home, ".agents/skills/steamloom/SKILL.md")); err != nil || string(content) != string(latest) {
		t.Fatalf("Skill 未正確安裝：%v", err)
	}
	if _, err := os.Stat(filepath.Join(home, ".agents/skills/storyteller-mcp")); !os.IsNotExist(err) {
		t.Fatalf("已驗證的舊版 skill 未移除：%v", err)
	}
	// 只處理選到的工具，不碰其他工具的目錄
	if _, err := os.Stat(filepath.Join(home, ".claude")); !os.IsNotExist(err) {
		t.Fatalf("不應寫入未選擇的工具：%v", err)
	}
}

func TestEnsureDoesNotDowngradeOrDeleteUnrelatedLegacy(t *testing.T) {
	service, home := newTestService(t, []byte("---\nname: steamloom\nmetadata:\n  version: \"2.3.0\"\n---\n"))
	currentPath := filepath.Join(home, ".claude/skills/steamloom/SKILL.md")
	legacyPath := filepath.Join(home, ".claude/skills/storyteller-mcp/SKILL.md")
	current := []byte("---\nname: steamloom\nmetadata:\n  version: \"3.0.0\"\n---\n")
	writeFile(t, currentPath, current)
	writeFile(t, legacyPath, []byte("---\nname: personal\n---\n"))

	result, err := service.Ensure(context.Background(), "claude")
	if err != nil {
		t.Fatal(err)
	}
	if result.Updated {
		t.Fatal("本機較新時不應回報已更新")
	}
	if got, _ := os.ReadFile(currentPath); string(got) != string(current) {
		t.Fatal("較新的本機 skill 不應被降版")
	}
	if _, err := os.Stat(legacyPath); err != nil {
		t.Fatalf("非 SteamLoom 的同名資料不應被刪除：%v", err)
	}
}

func TestEnsureRejectsInvalidDownloadedSkill(t *testing.T) {
	service, home := newTestService(t, []byte("<html>not a skill</html>"))
	if _, err := service.Ensure(context.Background(), "grok"); err == nil {
		t.Fatal("無效內容應回傳錯誤")
	}
	if _, err := os.Stat(filepath.Join(home, ".grok/skills/steamloom/SKILL.md")); !os.IsNotExist(err) {
		t.Fatalf("無效內容不應寫入：%v", err)
	}
}

func TestEnsureRejectsUnsupportedAgent(t *testing.T) {
	service, _ := newTestService(t, []byte("---\nname: steamloom\nmetadata:\n  version: \"2.3.0\"\n---\n"))
	if _, err := service.Ensure(context.Background(), "unknown"); err == nil {
		t.Fatal("不支援的工具應回傳錯誤")
	}
}

func TestSkillsDirSupportsGeminiAndAntigravity(t *testing.T) {
	tests := map[string]string{
		"gemini":      filepath.Join("home", ".gemini", "skills"),
		"antigravity": filepath.Join("home", ".gemini", "antigravity-cli", "skills"),
	}
	for agentID, want := range tests {
		got, err := skillsDir(agentID, "home")
		if err != nil || got != want {
			t.Fatalf("unexpected %s skill path: %q, %v", agentID, got, err)
		}
	}
}
