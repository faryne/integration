package skillupdate

import (
	"context"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"
)

func TestUpdateInstallsDetectedToolsAndRemovesVerifiedLegacy(t *testing.T) {
	home := t.TempDir()
	for _, dir := range []string{".claude", ".codex", ".agents/skills/storyteller-mcp"} {
		if err := os.MkdirAll(filepath.Join(home, dir), 0o755); err != nil {
			t.Fatal(err)
		}
	}
	legacy := []byte("---\nname: storyteller-mcp\nmetadata:\n  version: \"2.0.0\"\n---\n")
	if err := os.WriteFile(filepath.Join(home, ".agents/skills/storyteller-mcp/SKILL.md"), legacy, 0o644); err != nil {
		t.Fatal(err)
	}
	latest := []byte("---\nname: steamloom\nmetadata:\n  version: \"2.3.0\"\n---\n\nlatest\n")
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) { _, _ = w.Write(latest) }))
	defer server.Close()

	service := New(server.URL)
	service.homeDir = func() (string, error) { return home, nil }
	if err := service.Update(context.Background()); err != nil {
		t.Fatal(err)
	}
	for _, path := range []string{".claude/skills/steamloom/SKILL.md", ".agents/skills/steamloom/SKILL.md"} {
		content, err := os.ReadFile(filepath.Join(home, path))
		if err != nil || string(content) != string(latest) {
			t.Fatalf("%s 未正確安裝：%v", path, err)
		}
	}
	if _, err := os.Stat(filepath.Join(home, ".agents/skills/storyteller-mcp")); !os.IsNotExist(err) {
		t.Fatalf("已驗證的舊版 skill 未移除：%v", err)
	}
}

func TestUpdateDoesNotDowngradeOrDeleteUnrelatedLegacy(t *testing.T) {
	home := t.TempDir()
	currentPath := filepath.Join(home, ".agents/skills/steamloom/SKILL.md")
	legacyPath := filepath.Join(home, ".agents/skills/storyteller-mcp/SKILL.md")
	if err := os.MkdirAll(filepath.Dir(currentPath), 0o755); err != nil {
		t.Fatal(err)
	}
	if err := os.MkdirAll(filepath.Dir(legacyPath), 0o755); err != nil {
		t.Fatal(err)
	}
	current := []byte("---\nname: steamloom\nmetadata:\n  version: \"3.0.0\"\n---\n")
	if err := os.WriteFile(currentPath, current, 0o644); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(legacyPath, []byte("---\nname: personal\n---\n"), 0o644); err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("---\nname: steamloom\nmetadata:\n  version: \"2.3.0\"\n---\n"))
	}))
	defer server.Close()

	service := New(server.URL)
	service.homeDir = func() (string, error) { return home, nil }
	if err := service.Update(context.Background()); err != nil {
		t.Fatal(err)
	}
	got, _ := os.ReadFile(currentPath)
	if string(got) != string(current) {
		t.Fatal("較新的本機 skill 不應被降版")
	}
	if _, err := os.Stat(legacyPath); err != nil {
		t.Fatalf("非 SteamLoom 的同名資料不應被刪除：%v", err)
	}
}

func TestUpdateRejectsInvalidDownloadedSkill(t *testing.T) {
	home := t.TempDir()
	if err := os.MkdirAll(filepath.Join(home, ".claude"), 0o755); err != nil {
		t.Fatal(err)
	}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		_, _ = w.Write([]byte("<html>not a skill</html>"))
	}))
	defer server.Close()

	service := New(server.URL)
	service.homeDir = func() (string, error) { return home, nil }
	if err := service.Update(context.Background()); err == nil {
		t.Fatal("無效內容應回傳錯誤")
	}
	if _, err := os.Stat(filepath.Join(home, ".claude/skills/steamloom/SKILL.md")); !os.IsNotExist(err) {
		t.Fatalf("無效內容不應寫入：%v", err)
	}
}
