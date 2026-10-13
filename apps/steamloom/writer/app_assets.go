package main

import (
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
