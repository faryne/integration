// Package appsettings 管理 SteamLoom Writer 的裝置層級偏好。
package appsettings

import (
	"encoding/json"
	"errors"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"strings"
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
	Language           Language `json:"language"`
	StoragePath        string   `json:"storage_path"`
	DefaultStoragePath string   `json:"default_storage_path"`
}

type Service struct {
	mu           sync.RWMutex
	defaultRoot  string
	activeRoot   string
	desiredRoot  string
	settingsName string
	locationPath string
	current      Settings
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
	if settings.StoragePath == "" || !filepath.IsAbs(settings.StoragePath) {
		return errors.New("儲存位置必須是絕對路徑")
	}
	return nil
}

// New 載入指定設定檔；不存在時使用預設值，格式或內容不合法時回傳錯誤。
func New(path string) (*Service, error) {
	root := filepath.Clean(filepath.Dir(path))
	service := &Service{defaultRoot: root, activeRoot: root, desiredRoot: root, settingsName: filepath.Base(path)}
	service.current = service.runtimeSettings(Default().Language, root)
	raw, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return service, nil
	}
	if err != nil {
		return nil, err
	}
	var settings diskSettings
	if err := json.Unmarshal(raw, &settings); err != nil {
		return nil, err
	}
	if !validLanguage(settings.Language) {
		return nil, fmt.Errorf("不支援的介面語言：%s", settings.Language)
	}
	service.current = service.runtimeSettings(settings.Language, root)
	return service, nil
}

func (s *Service) runtimeSettings(language Language, storagePath string) Settings {
	return Settings{Language: language, StoragePath: storagePath, DefaultStoragePath: s.defaultRoot}
}

func normalizeStoragePath(path, fallback string) (string, error) {
	path = strings.TrimSpace(path)
	if path == "" {
		path = fallback
	}
	abs, err := filepath.Abs(path)
	if err != nil {
		return "", err
	}
	return filepath.Clean(abs), nil
}

func (s *Service) settingsPath(root string) string { return filepath.Join(root, s.settingsName) }

func (s *Service) StorageRoot() string {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.activeRoot
}

func (s *Service) Get() Settings {
	s.mu.RLock()
	defer s.mu.RUnlock()
	return s.current
}

// Save 保存介面偏好；若變更資料根目錄，先複製現有資料並把切換排到下次啟動。
func (s *Service) Save(input Settings) error {
	desired, err := normalizeStoragePath(input.StoragePath, s.defaultRoot)
	if err != nil {
		return err
	}
	settings := s.runtimeSettings(input.Language, desired)
	if err := validate(settings); err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	if desired != s.activeRoot && desired != s.desiredRoot {
		if err := copyDataRoot(s.activeRoot, desired, s.locationPath); err != nil {
			return err
		}
	}
	if err := writeDiskSettings(s.settingsPath(s.activeRoot), settings.Language); err != nil {
		return err
	}
	if desired != s.activeRoot {
		if err := writeDiskSettings(s.settingsPath(desired), settings.Language); err != nil {
			return err
		}
	}
	if s.locationPath != "" {
		if err := writeLocation(s.locationPath, s.defaultRoot, storageLocation{ActivePath: s.activeRoot, PendingPath: pathUnlessEqual(desired, s.activeRoot)}); err != nil {
			return err
		}
	}
	s.desiredRoot, s.current = desired, settings
	return nil
}

func pathUnlessEqual(path, other string) string {
	if path == other {
		return ""
	}
	return path
}

// NewDefault 使用各作業系統的 config 目錄保存啟動指標；實際資料可移到使用者指定的位置。
func NewDefault() *Service {
	dir, err := os.UserConfigDir()
	if err != nil {
		dir = "."
	}
	defaultRoot, _ := filepath.Abs(filepath.Join(dir, "SteamLoom Writer"))
	service, err := newManaged(defaultRoot)
	if err == nil {
		return service
	}
	log.Printf("load Writer settings: %v; fallback to %s", err, LanguageZHTW)
	service = &Service{defaultRoot: defaultRoot, activeRoot: defaultRoot, desiredRoot: defaultRoot, settingsName: "settings.json", locationPath: filepath.Join(defaultRoot, locationFileName)}
	service.current = service.runtimeSettings(LanguageZHTW, defaultRoot)
	return service
}
