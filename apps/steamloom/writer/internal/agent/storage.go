package agent

import (
	"path/filepath"
	"sync"
)

var configuredStorage struct {
	sync.RWMutex
	root string
}

// ConfigureStorageRoot 在 Writer 啟動時指定本機資料根目錄；執行中的程式不切換，避免同一輪工作被拆到兩個目錄。
func ConfigureStorageRoot(root string) {
	configuredStorage.Lock()
	configuredStorage.root = filepath.Clean(root)
	configuredStorage.Unlock()
}

func storageRoot() (string, error) {
	configuredStorage.RLock()
	root := configuredStorage.root
	configuredStorage.RUnlock()
	if root != "" {
		return root, nil
	}
	base, err := userConfigDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(base, "SteamLoom Writer"), nil
}
