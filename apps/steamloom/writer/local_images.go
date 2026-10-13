package main

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"net/http"
	"path/filepath"
	"strings"
	"sync"

	"faryne.dev/apps/steamloom/writer/internal/api"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// 圖像作品跟網站一樣「按存檔才上傳」：選好的本機圖檔先登記在這裡，前端只拿到 token，
// 預覽圖透過 AssetServer middleware 的 /local-image/<token> 讀檔（WebView 不能直接讀任意本機路徑），
// 存檔時再用 token 換回路徑上傳成資產。只有原生選檔視窗選出來的路徑會被登記，前端沒辦法指定任意檔案。
const localImagePrefix = "/local-image/"

type localImages struct {
	mu    sync.Mutex
	paths map[string]string
}

func (l *localImages) add(path string) string {
	buf := make([]byte, 12)
	_, _ = rand.Read(buf)
	token := hex.EncodeToString(buf)
	l.mu.Lock()
	defer l.mu.Unlock()
	if l.paths == nil {
		l.paths = map[string]string{}
	}
	l.paths[token] = path
	return token
}

func (l *localImages) path(token string) (string, bool) {
	l.mu.Lock()
	defer l.mu.Unlock()
	path, ok := l.paths[token]
	return path, ok
}

// LocalImage 是選好但還沒上傳的一張圖；PreviewURL 是 WebView 讀得到的預覽網址。
type LocalImage struct {
	Token      string `json:"token"`
	Name       string `json:"name"`
	PreviewURL string `json:"preview_url"`
}

// LocalImagePick 是一次選檔的結果；Skipped 是格式不支援或超過 15 MB 而沒加入的檔名。
type LocalImagePick struct {
	Files   []LocalImage `json:"files"`
	Skipped []string     `json:"skipped"`
}

// PickImageFiles 開原生選檔視窗（可多選）挑圖像作品的頁面；使用者取消時回傳 nil。
func (a *App) PickImageFiles() (*LocalImagePick, error) {
	paths, err := runtime.OpenMultipleFilesDialog(a.ctx, runtime.OpenDialogOptions{
		Title:   "選擇圖片",
		Filters: []runtime.FileFilter{{DisplayName: "圖片（JPEG／PNG／WebP／GIF）", Pattern: api.AssetFileFilter()}},
	})
	if err != nil || len(paths) == 0 {
		return nil, err
	}
	pick := &LocalImagePick{Files: []LocalImage{}, Skipped: []string{}}
	for _, path := range paths {
		name := filepath.Base(path)
		if _, ok := api.CheckAssetFile(path); !ok {
			pick.Skipped = append(pick.Skipped, name)
			continue
		}
		token := a.localImages.add(path)
		pick.Files = append(pick.Files, LocalImage{Token: token, Name: name, PreviewURL: localImagePrefix + token})
	}
	return pick, nil
}

// UploadLocalImages 把選好的本機圖上傳成資產（未分類，跟網站一樣），回傳「token → 資產 public_id」。
// 有失敗的不會整批報錯：成功的照樣回傳，前端據此保留已上傳的頁面、重試時只傳剩下的。
func (a *App) UploadLocalImages(project string, tokens []string) (map[string]string, error) {
	var paths []string
	byPath := map[string]string{}
	for _, token := range tokens {
		path, ok := a.localImages.path(token)
		if !ok {
			return nil, fmt.Errorf("找不到選好的圖片，請重新加入")
		}
		paths = append(paths, path)
		byPath[path] = token
	}
	result, err := a.api.UploadAssets(a.ctx, project, "", paths)
	if result == nil {
		return nil, err
	}
	uploaded := map[string]string{}
	for path, asset := range result.Created {
		uploaded[byPath[path]] = asset
	}
	if len(uploaded) == 0 && err != nil {
		return nil, err
	}
	return uploaded, nil
}

// localImageMiddleware 讓 WebView 用 /local-image/<token> 讀到登記過的本機圖檔，其他請求照常交給 Wails。
func (a *App) localImageMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token, ok := strings.CutPrefix(r.URL.Path, localImagePrefix)
		if !ok {
			next.ServeHTTP(w, r)
			return
		}
		path, found := a.localImages.path(token)
		if !found {
			http.NotFound(w, r)
			return
		}
		http.ServeFile(w, r, path)
	})
}
