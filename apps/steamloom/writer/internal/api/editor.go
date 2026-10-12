package api

import (
	"context"
	"net/http"
)

// SaveInput 是編輯分頁存檔送出的內容；故事與設定都有標題、摘要、內文。
// Trigger 是 "manual" 或 "auto"，讓版本記錄跟網站一樣分得出手動／自動存檔；
// BaseVersionID 是打開（或上次存檔）時的最新版本，後端據此判斷中途是否被別處改過。
type SaveInput struct {
	Title         string  `json:"title"`
	Summary       string  `json:"summary"`
	Content       string  `json:"content"`
	Trigger       string  `json:"trigger"`
	BaseVersionID *uint64 `json:"base_version_id"`
}

// SaveResult 是存檔後前端需要更新的狀態。VersionConflict=true 代表內容照樣存成新版本，
// 但存檔前已經有別的地方（網站、AI 助理）改過，要提示使用者去編輯歷史確認。
type SaveResult struct {
	LatestVersionID *uint64 `json:"latest_version_id"`
	WordCount       uint    `json:"word_count"`
	UpdatedAt       string  `json:"updated_at"`
	VersionConflict bool    `json:"version_conflict"`
}

// EditorLore／EditorAsset 只帶編輯器用到的欄位（見 static_site StorytellerEditorDataContext）。
type EditorLore struct {
	PublicID string `json:"public_id"`
	Title    string `json:"title"`
	Status   string `json:"status"`
}

type EditorAsset struct {
	PreviewURL       string `json:"preview_url"`
	Title            string `json:"title"`
	OriginalFilename string `json:"original_filename"`
}

// SaveDocument 存檔故事或設定，每次都會產生一個新版本。
// 故事的 PUT 會整筆覆寫 status／sort（沒帶就變成預設值），編輯頁又不改這兩個欄位，
// 所以先讀一次伺服器上目前的值再送，避免把側邊列剛排好的順序或剛切換的狀態蓋回去。
// 設定的 status 是「省略＝不變更」，只送標題、摘要與內文。
func (c *Client) SaveDocument(ctx context.Context, project string, kind DocumentKind, id string, input SaveInput) (*SaveResult, error) {
	path, err := documentPath(project, kind, id)
	if err != nil {
		return nil, err
	}
	body := map[string]any{"title": input.Title, "summary": input.Summary, "content": input.Content, "save_trigger": input.Trigger, "base_version_id": input.BaseVersionID}
	if kind == KindStory {
		current, err := get[struct {
			Status string `json:"status"`
			Sort   int    `json:"sort"`
		}](ctx, c, path)
		if err != nil {
			return nil, err
		}
		body["status"], body["sort"] = current.Status, current.Sort
	}
	return request[*SaveResult](ctx, c, http.MethodPut, path, body)
}

func (c *Client) Lores(ctx context.Context, project string) ([]EditorLore, error) {
	return get[[]EditorLore](ctx, c, "/projects/"+project+"/lores")
}

// Asset 回傳單一資產；preview_url 是有時效的簽名網址，前端快取要比網站的 45 分鐘刷新更短。
func (c *Client) Asset(ctx context.Context, project, id string) (*EditorAsset, error) {
	return get[*EditorAsset](ctx, c, "/projects/"+project+"/assets/"+id)
}
