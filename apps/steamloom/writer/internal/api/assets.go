package api

import (
	"bytes"
	"context"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"path/filepath"
	"strings"
	"time"
)

// 跟網站 data/storyteller.ts 的 STORYTELLER_IMAGE_PAGE_* 一致；後端 presign 也會再驗一次。
const (
	maxAssetBytes = 15 << 20
	maxAssetCount = 60
)

var assetMimeTypes = map[string]string{
	".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png", ".webp": "image/webp", ".gif": "image/gif",
}

// AssetFileFilter 是原生選檔視窗的副檔名過濾，跟允許的類型同一份。
func AssetFileFilter() string {
	exts := make([]string, 0, len(assetMimeTypes))
	for ext := range assetMimeTypes {
		exts = append(exts, "*"+ext)
	}
	return strings.Join(exts, ";")
}

// Asset 對應網站的 StorytellerAsset（資產卡片與資產詳細頁用到的欄位）；PreviewURL 是後端當下簽的網址，有時效，不要落地保存。
// CollectionID 是資產集 public_id，空字串＝未分類；ReferenceCount>0 代表仍被作品引用，不能刪。
type Asset struct {
	PublicID         string         `json:"public_id"`
	CollectionID     string         `json:"collection_id"`
	AssetType        string         `json:"asset_type"`
	MimeType         string         `json:"mime_type"`
	FileExt          string         `json:"file_ext"`
	FileSize         uint64         `json:"file_size"`
	Metadata         map[string]any `json:"metadata"`
	OriginalFilename string         `json:"original_filename"`
	Title            string         `json:"title"`
	AltText          string         `json:"alt_text"`
	Description      string         `json:"description"`
	PreviewURL       string         `json:"preview_url"`
	ReferenceCount   int64          `json:"reference_count"`
	CreatedAt        string         `json:"created_at"`
	UpdatedAt        string         `json:"updated_at"`
}

type AssetPage struct {
	Assets     []Asset `json:"assets"`
	TotalCount int64   `json:"total_count"`
	Page       int     `json:"page"`
	PageSize   int     `json:"page_size"`
}

// UncategorizedAssets 是「未分類」資產的篩選值（後端 assetCollectionUncategorized）。
const UncategorizedAssets = "__uncategorized__"

// Assets 分頁列出專案的圖片資產，查詢參數照網站（資產列表每頁 24、資產選擇對話框每頁 12）：
// collection 空字串＝全部、UncategorizedAssets＝未分類、其他＝資產集 public_id；keyword 比對標題等文字。
func (c *Client) Assets(ctx context.Context, project, collection, keyword string, page, pageSize int) (*AssetPage, error) {
	query := url.Values{"page": {fmt.Sprint(page)}, "page_size": {fmt.Sprint(pageSize)}, "asset_type": {"image"}}
	if collection != "" {
		query.Set("collection_id", collection)
	}
	if keyword = strings.TrimSpace(keyword); keyword != "" {
		query.Set("keyword", keyword)
	}
	return get[*AssetPage](ctx, c, "/projects/"+project+"/assets?"+query.Encode())
}

// UploadResult 回報這次上傳成功幾張、哪些檔案因為格式或大小被略過。
// Created 是「本機路徑 → 新資產 public_id」，圖像作品存檔時用來把頁面換成資產（前端不需要，所以不輸出）。
type UploadResult struct {
	Uploaded int               `json:"uploaded"`
	Skipped  []string          `json:"skipped"`
	Created  map[string]string `json:"-"`
}

// CheckAssetFile 檢查本機檔案是不是可以上傳的圖片（格式、15 MB 上限），回傳對應的 MIME type。
func CheckAssetFile(path string) (string, bool) {
	mime, ok := assetMimeTypes[strings.ToLower(filepath.Ext(path))]
	info, err := os.Stat(path)
	return mime, ok && err == nil && info.Size() <= maxAssetBytes
}

type assetFile struct {
	path, name, mime string
	data             []byte
}

// UploadAssets 跟網站一樣分兩段：先 presign 拿 S3 上傳網址、直傳 S3，完成後 confirm 建立資產。
// collection 是資產集 public_id（空字串＝未分類）。不支援的格式、超過 15 MB 的檔案會略過並回報。
func (c *Client) UploadAssets(ctx context.Context, project, collection string, paths []string) (*UploadResult, error) {
	result := &UploadResult{Skipped: []string{}, Created: map[string]string{}}
	var files []assetFile
	for _, path := range paths {
		name := filepath.Base(path)
		mime, ok := CheckAssetFile(path)
		if !ok || len(files) >= maxAssetCount {
			result.Skipped = append(result.Skipped, name)
			continue
		}
		data, err := os.ReadFile(path)
		if err != nil {
			result.Skipped = append(result.Skipped, name)
			continue
		}
		files = append(files, assetFile{path: path, name: name, mime: mime, data: data})
	}
	if len(files) == 0 {
		return result, nil
	}

	base := "/projects/" + project + "/assets"
	requests := make([]map[string]string, len(files))
	for i, file := range files {
		requests[i] = map[string]string{"content_type": file.mime, "original_filename": file.name}
	}
	targets, err := request[[]struct {
		Key       string `json:"key"`
		UploadURL string `json:"upload_url"`
		Tagging   string `json:"tagging"`
	}](ctx, c, http.MethodPost, base+"/presign", map[string]any{"files": requests})
	if err != nil {
		return result, err
	}
	if len(targets) != len(files) {
		return result, fmt.Errorf("部分資產沒有取得上傳網址，請檢查資產清單後重試")
	}
	for i, file := range files {
		if err := putToStorage(ctx, targets[i].UploadURL, targets[i].Tagging, file); err != nil {
			return result, fmt.Errorf("上傳 %s 失敗：%w", file.name, err)
		}
		created, err := request[createdRow](ctx, c, http.MethodPost, base+"/confirm", map[string]any{
			"key": targets[i].Key, "content_type": file.mime, "collection_id": collection,
			"original_filename": file.name, "title": file.name, "alt_text": "", "description": "", "metadata": map[string]any{},
		})
		if err != nil {
			return result, fmt.Errorf("建立資產 %s 失敗：%w", file.name, err)
		}
		result.Uploaded++
		result.Created[file.path] = created.PublicID
	}
	return result, nil
}

// storageClient 給直傳 S3 用，大檔需要比 API 呼叫更長的時限。
var storageClient = &http.Client{Timeout: 5 * time.Minute}

// putToStorage 直傳 presigned URL；簽名時帶了 Content-Type 與 tagging，這兩個 header 必須一模一樣。
func putToStorage(ctx context.Context, uploadURL, tagging string, file assetFile) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodPut, uploadURL, bytes.NewReader(file.data))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", file.mime)
	req.Header.Set("x-amz-tagging", tagging)
	resp, err := storageClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= http.StatusBadRequest {
		return fmt.Errorf("HTTP %d", resp.StatusCode)
	}
	return nil
}
