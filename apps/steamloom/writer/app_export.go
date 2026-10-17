package main

import (
	"errors"
	"net/http"
	"os"
	"path/filepath"
	"time"

	"faryne.dev/apps/steamloom/writer/internal/api"
	"faryne.dev/apps/steamloom/writer/internal/backup"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// ExportProjectBackup 開原生存檔對話框，把整個專案匯出成 zip（故事、設定、manifest；includeImages 時含圖像作品的圖片）。
// 使用者取消選檔時回傳空字串。先寫到同目錄的暫存檔，完整寫完才改名，失敗不會留下半個 zip。
func (a *App) ExportProjectBackup(projectID string, includeImages bool) (string, error) {
	projects, err := a.api.Projects(a.ctx)
	if err != nil {
		return "", err
	}
	var project *api.Project
	for i := range projects {
		if projects[i].PublicID == projectID {
			project = &projects[i]
			break
		}
	}
	if project == nil {
		return "", errors.New("找不到這個專案")
	}
	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		Title:           "匯出專案備份",
		DefaultFilename: backup.FileName(*project, time.Now()),
		Filters:         []runtime.FileFilter{{DisplayName: "ZIP 壓縮檔", Pattern: "*.zip"}},
	})
	if err != nil || path == "" {
		return "", err
	}
	tmp, err := os.CreateTemp(filepath.Dir(path), ".steamloom-backup-*.zip")
	if err != nil {
		return "", err
	}
	defer os.Remove(tmp.Name())
	if err := backup.Write(a.ctx, tmp, a.api, &http.Client{Timeout: 2 * time.Minute}, *project, includeImages); err != nil {
		tmp.Close()
		return "", err
	}
	if err := tmp.Close(); err != nil {
		return "", err
	}
	return path, os.Rename(tmp.Name(), path)
}
