package appsettings

import (
	"os"
	"path/filepath"
	"testing"
)

func TestNewDefaultsToTraditionalChinese(t *testing.T) {
	service, err := New(filepath.Join(t.TempDir(), "settings.json"))
	if err != nil {
		t.Fatal(err)
	}
	if got := service.Get().Language; got != LanguageZHTW {
		t.Fatalf("Language = %q, want %q", got, LanguageZHTW)
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
