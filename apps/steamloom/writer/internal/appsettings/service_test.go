package appsettings

import (
	"os"
	"path/filepath"
	"testing"
)

func TestNewDefaultsToTraditionalChinese(t *testing.T) {
	root := t.TempDir()
	service, err := New(filepath.Join(root, "settings.json"))
	if err != nil {
		t.Fatal(err)
	}
	settings := service.Get()
	if got := settings.Language; got != LanguageZHTW {
		t.Fatalf("Language = %q, want %q", got, LanguageZHTW)
	}
	if settings.StoragePath != root || settings.DefaultStoragePath != root {
		t.Fatalf("storage paths = %#v, want %q", settings, root)
	}
}

func TestSaveAndLoad(t *testing.T) {
	path := filepath.Join(t.TempDir(), "nested", "settings.json")
	service, err := New(path)
	if err != nil {
		t.Fatal(err)
	}
	if err := service.Save(Settings{Language: LanguageJA}); err != nil {
		t.Fatal(err)
	}
	loaded, err := New(path)
	if err != nil {
		t.Fatal(err)
	}
	if got := loaded.Get().Language; got != LanguageJA {
		t.Fatalf("Language = %q, want %q", got, LanguageJA)
	}
	info, err := os.Stat(path)
	if err != nil {
		t.Fatal(err)
	}
	if got := info.Mode().Perm(); got != 0o600 {
		t.Fatalf("mode = %o, want 600", got)
	}
}

func TestManagedStorageMigrationCompletesOnNextLaunch(t *testing.T) {
	defaultRoot := filepath.Join(t.TempDir(), "SteamLoom Writer")
	chat := filepath.Join(defaultRoot, "chats", "codex", "project", "thread.jsonl")
	if err := os.MkdirAll(filepath.Dir(chat), 0o700); err != nil {
		t.Fatal(err)
	}
	if err := os.WriteFile(chat, []byte("before"), 0o600); err != nil {
		t.Fatal(err)
	}
	service, err := newManaged(defaultRoot)
	if err != nil {
		t.Fatal(err)
	}
	target := filepath.Join(t.TempDir(), "Writer Data")
	if err := service.Save(Settings{Language: LanguageJA, StoragePath: target}); err != nil {
		t.Fatal(err)
	}
	if service.StorageRoot() != defaultRoot || service.Get().StoragePath != target {
		t.Fatalf("storage state = active %q, settings %#v", service.StorageRoot(), service.Get())
	}
	if copied, err := os.ReadFile(filepath.Join(target, "chats", "codex", "project", "thread.jsonl")); err != nil || string(copied) != "before" {
		t.Fatalf("initial copy = %q, %v", copied, err)
	}
	// 儲存後到程式結束前仍可能有最後一批對話；下次啟動會再同步一次才切換。
	if err := os.WriteFile(chat, []byte("latest"), 0o600); err != nil {
		t.Fatal(err)
	}
	restarted, err := newManaged(defaultRoot)
	if err != nil {
		t.Fatal(err)
	}
	if restarted.StorageRoot() != target || restarted.Get().StoragePath != target || restarted.Get().Language != LanguageJA {
		t.Fatalf("restarted settings = %#v, active %q", restarted.Get(), restarted.StorageRoot())
	}
	if copied, err := os.ReadFile(filepath.Join(target, "chats", "codex", "project", "thread.jsonl")); err != nil || string(copied) != "latest" {
		t.Fatalf("final copy = %q, %v", copied, err)
	}
	location, err := readLocation(filepath.Join(defaultRoot, locationFileName), defaultRoot)
	if err != nil || location.ActivePath != target || location.PendingPath != "" {
		t.Fatalf("location = %#v, %v", location, err)
	}
}

func TestManagedStorageRejectsNestedTarget(t *testing.T) {
	defaultRoot := filepath.Join(t.TempDir(), "SteamLoom Writer")
	service, err := newManaged(defaultRoot)
	if err != nil {
		t.Fatal(err)
	}
	err = service.Save(Settings{Language: LanguageZHTW, StoragePath: filepath.Join(defaultRoot, "nested")})
	if err == nil {
		t.Fatal("Save() error = nil, want nested storage path error")
	}
}

func TestRejectsUnsupportedLanguageWithoutChangingCurrent(t *testing.T) {
	service, err := New(filepath.Join(t.TempDir(), "settings.json"))
	if err != nil {
		t.Fatal(err)
	}
	if err := service.Save(Settings{Language: "zh"}); err == nil {
		t.Fatal("Save() error = nil, want unsupported language error")
	}
	if got := service.Get().Language; got != LanguageZHTW {
		t.Fatalf("Language = %q, want %q", got, LanguageZHTW)
	}
}

func TestNewRejectsInvalidFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "settings.json")
	if err := os.WriteFile(path, []byte(`{"language":"zh"}`), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := New(path); err == nil {
		t.Fatal("New() error = nil, want validation error")
	}
}
