// Package appsettings 管理 SteamLoom Writer 的裝置層級偏好。
package appsettings

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"
)

type Language string

const (
	LanguageZHTW Language = "zh-TW"
	LanguageZHCN Language = "zh-CN"
	LanguageEN   Language = "en"
	LanguageJA   Language = "ja"
	LanguageKO   Language = "ko"
)

type Settings struct {
	Language Language `json:"language"`
}

type Service struct {
	mu      sync.RWMutex
	path    string
	current Settings
}

func Default() Settings { return Settings{Language: LanguageZHTW} }

func validLanguage(language Language) bool {
	switch language {
	case LanguageZHTW, LanguageZHCN, LanguageEN, LanguageJA, LanguageKO:
		return true
	default:
		return false
	}
}

func validate(settings Settings) error {
	if !validLanguage(settings.Language) {
		return fmt.Errorf("不支援的介面語言：%s", settings.Language)
	}
	return nil
}

// New 載入指定設定檔；不存在時使用預設值，格式或內容不合法時回傳錯誤。
func New(path string) (*Service, error) {
	service := &Service{path: path, current: Default()}
	raw, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return service, nil
	}
	if err != nil {
		return nil, err
	}
	var settings Settings
	if err := json.Unmarshal(raw, &settings); err != nil {
		return nil, err
	}
	if err := validate(settings); err != nil {
		return nil, err
	}
	service.current = settings
	return service, nil
}

// NewDefault 使用各作業系統的使用者設定目錄。設定檔損壞時只記錄錯誤並退回正體中文，避免 Writer 無法啟動。
func NewDefault() *Service {
	dir, err := os.UserConfigDir()
	if err != nil {
		dir = "."
	}
	path := filepath.Join(dir, "SteamLoom Writer", "settings.json")
	service, err := New(path)
	if err == nil {
		return service
	}
	log.Printf("load Writer settings: %v; fallback to %s", err, LanguageZHTW)
	return &Service{path: path, current: Default()}
}

func (s *Service) Get() Settings {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.current
}

// Save 先寫入同目錄暫存檔再 rename；只有完整寫入成功才更新記憶體中的設定。
func (s *Service) Save(settings Settings) error {
	if err := validate(settings); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := os.MkdirAll(filepath.Dir(s.path), 0o700); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(settings, "", "  ")
	if err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(s.path), "settings-*.json")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)
	if err := tmp.Chmod(0o600); err != nil {
		tmp.Close()
		return err
	}
	if _, err := tmp.Write(raw); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if err := os.Rename(tmpName, s.path); err != nil {
		return err
	}
	s.current = settings
	return nil
}
