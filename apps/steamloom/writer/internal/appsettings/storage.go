package appsettings

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"log"
	"os"
	"path/filepath"
	"strings"
)

const locationFileName = "storage-location.json"

type diskSettings struct {
	Language Language `json:"language"`
}

type storageLocation struct {
	ActivePath  string `json:"active_path"`
	PendingPath string `json:"pending_path,omitempty"`
}

func newManaged(defaultRoot string) (*Service, error) {
	defaultRoot = filepath.Clean(defaultRoot)
	locationPath := filepath.Join(defaultRoot, locationFileName)
	location, err := readLocation(locationPath, defaultRoot)
	if err != nil {
		return nil, err
	}
	if location.PendingPath != "" {
		if err := copyDataRoot(location.ActivePath, location.PendingPath, locationPath); err != nil {
			// 搬移失敗時繼續使用舊目錄，保留 pending 讓下次啟動再試，避免 Writer 因外接磁碟離線而打不開。
			log.Printf("migrate Writer local data: %v; keep using %s", err, location.ActivePath)
		} else {
			location.ActivePath, location.PendingPath = location.PendingPath, ""
			if err := writeLocation(locationPath, defaultRoot, location); err != nil {
				return nil, err
			}
		}
	}
	service, err := New(filepath.Join(location.ActivePath, "settings.json"))
	if err != nil {
		return nil, err
	}
	desiredRoot := location.ActivePath
	if location.PendingPath != "" {
		desiredRoot = location.PendingPath
	}
	service.defaultRoot, service.activeRoot, service.desiredRoot, service.locationPath = defaultRoot, location.ActivePath, desiredRoot, locationPath
	service.current = service.runtimeSettings(service.current.Language, desiredRoot)
	return service, nil
}

func readLocation(path, defaultRoot string) (storageLocation, error) {
	location := storageLocation{ActivePath: defaultRoot}
	raw, err := os.ReadFile(path)
	if errors.Is(err, os.ErrNotExist) {
		return location, nil
	}
	if err != nil {
		return storageLocation{}, err
	}
	if err := json.Unmarshal(raw, &location); err != nil {
		return storageLocation{}, err
	}
	for _, value := range []*string{&location.ActivePath, &location.PendingPath} {
		if *value == "" {
			continue
		}
		normalized, err := normalizeStoragePath(*value, defaultRoot)
		if err != nil {
			return storageLocation{}, err
		}
		*value = normalized
	}
	if location.ActivePath == "" {
		location.ActivePath = defaultRoot
	}
	return location, nil
}

func writeLocation(path, defaultRoot string, location storageLocation) error {
	if location.ActivePath == defaultRoot && location.PendingPath == "" {
		if err := os.Remove(path); err != nil && !errors.Is(err, os.ErrNotExist) {
			return err
		}
		return nil
	}
	return writeJSON(path, location)
}

func writeDiskSettings(path string, language Language) error {
	return writeJSON(path, diskSettings{Language: language})
}

func writeJSON(path string, value any) error {
	if err := os.MkdirAll(filepath.Dir(path), 0o700); err != nil {
		return err
	}
	raw, err := json.MarshalIndent(value, "", "  ")
	if err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(path), ".writer-*.json")
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
	return os.Rename(tmpName, path)
}

// copyDataRoot 只複製一般檔案與目錄；符號連結不跟隨，避免自訂目錄把任意外部檔案帶進遷移。
func copyDataRoot(source, target, locationPath string) error {
	source, target = filepath.Clean(source), filepath.Clean(target)
	if source == target {
		return nil
	}
	if rel, err := filepath.Rel(source, target); err == nil && rel != ".." && !strings.HasPrefix(rel, ".."+string(filepath.Separator)) {
		return errors.New("新的儲存位置不能放在目前資料目錄裡")
	}
	if err := os.MkdirAll(target, 0o700); err != nil {
		return err
	}
	return filepath.WalkDir(source, func(path string, entry fs.DirEntry, walkErr error) error {
		if errors.Is(walkErr, os.ErrNotExist) && path == source {
			return nil
		}
		if walkErr != nil {
			return walkErr
		}
		if path == locationPath {
			return nil
		}
		rel, err := filepath.Rel(source, path)
		if err != nil || rel == "." {
			return err
		}
		destination := filepath.Join(target, rel)
		if entry.IsDir() {
			return os.MkdirAll(destination, 0o700)
		}
		info, err := entry.Info()
		if err != nil {
			return err
		}
		if !info.Mode().IsRegular() {
			return fmt.Errorf("無法搬移特殊檔案：%s", path)
		}
		return copyFile(path, destination, info.Mode().Perm())
	})
}

func copyFile(source, target string, permission fs.FileMode) error {
	input, err := os.Open(source)
	if err != nil {
		return err
	}
	defer input.Close()
	if err := os.MkdirAll(filepath.Dir(target), 0o700); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(target), ".writer-copy-*")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)
	if err := tmp.Chmod(permission); err != nil {
		tmp.Close()
		return err
	}
	if _, err := io.Copy(tmp, input); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmpName, target)
}
