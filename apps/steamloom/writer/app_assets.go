package main

import (
	"errors"

	"faryne.dev/apps/steamloom/writer/internal/api"
	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// 資產相關的綁定：列表、上傳、資產詳細頁的修改／移動／刪除、資產集編輯／刪除。

// Assets 是資產列表的資料，分頁從 1 開始；collection 空字串＝全部、"__uncategorized__"＝未分類。
func (a *App) Assets(project, collection, keyword string, page, pageSize int) (*api.AssetPage, error) {
	return a.api.Assets(a.ctx, project, collection, keyword, page, pageSize)
}

// ImagePages 是圖像作品編輯頁的頁面清單（含簽名預覽網址）。
func (a *App) ImagePages(project, story string) ([]api.ImagePage, error) {
	return a.api.ImagePages(a.ctx, project, story)
}

// UploadAssets 開原生選檔視窗（可多選），上傳到指定資產集（空字串＝未分類）；使用者取消選檔時回傳 nil。
func (a *App) UploadAssets(project, collection string) (*api.UploadResult, error) {
	paths, err := runtime.OpenMultipleFilesDialog(a.ctx, runtime.OpenDialogOptions{
		Title:   "選擇要上傳的圖片",
		Filters: []runtime.FileFilter{{DisplayName: "圖片（JPEG／PNG／WebP／GIF）", Pattern: api.AssetFileFilter()}},
	})
	if err != nil || len(paths) == 0 {
		return nil, err
	}
	return a.api.UploadAssets(a.ctx, project, collection, paths)
}

func (a *App) UpdateAsset(project, asset string, input api.AssetInput) (*api.Asset, error) {
	return a.api.UpdateAsset(a.ctx, project, asset, input)
}

func (a *App) MoveAsset(project, asset, collection string) (*api.Asset, error) {
	return a.api.MoveAsset(a.ctx, project, asset, collection)
}

func (a *App) DeleteAsset(project, asset string) error {
	return a.api.DeleteAsset(a.ctx, project, asset)
}

func (a *App) UpdateAssetCollection(project, collection, name, description string) error {
	return a.api.UpdateAssetCollection(a.ctx, project, collection, name, description)
}

func (a *App) DeleteAssetCollection(project, collection string) error {
	return a.api.DeleteAssetCollection(a.ctx, project, collection)
}

// UploadedImage 是 UploadImageAsset 的結果，欄位對應網站資產選擇器的 EditorPickerAsset。
type UploadedImage struct {
	PublicID         string `json:"public_id"`
	PreviewURL       string `json:"preview_url"`
	Title            string `json:"title"`
	OriginalFilename string `json:"original_filename"`
}

// UploadImageAsset 開原生選檔視窗選一張圖、上傳成未分類資產並回傳（專案封面用）；使用者取消選檔時回傳 nil。
// 網站的封面上傳走 S3 直傳，ApiProxy 無法轉發，所以 Writer 改由 Go 上傳。
func (a *App) UploadImageAsset(project string) (*UploadedImage, error) {
	path, err := runtime.OpenFileDialog(a.ctx, runtime.OpenDialogOptions{
		Title:   "選擇封面圖片",
		Filters: []runtime.FileFilter{{DisplayName: "圖片（JPEG／PNG／WebP／GIF）", Pattern: api.AssetFileFilter()}},
	})
	if err != nil || path == "" {
		return nil, err
	}
	result, err := a.api.UploadAssets(a.ctx, project, "", []string{path})
	if err != nil {
		return nil, err
	}
	id := result.Created[path]
	if id == "" {
		// 格式或大小不符的檔案會被略過而不是報錯
		return nil, errors.New("封面只接受 JPEG／PNG／WebP／GIF 圖片，且不能超過 15MB")
	}
	asset, err := a.api.Asset(a.ctx, project, id)
	if err != nil {
		return nil, err
	}
	return &UploadedImage{PublicID: id, PreviewURL: asset.PreviewURL, Title: asset.Title, OriginalFilename: asset.OriginalFilename}, nil
}
