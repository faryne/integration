package api

import (
	"context"
	"net/http"
)

// SaveInput 是編輯分頁存檔送出的內容；故事與設定都有標題、摘要、內文。
// Trigger 是 "manual" 或 "auto"，讓版本記錄跟網站一樣分得出手動／自動存檔；
// BaseVersionID 是打開（或上次存檔）時的最新版本，後端據此判斷中途是否被別處改過。
// 狀態、冊／設定集、署名不在這裡：屬性一變更就走 PatchDocument，不寫版本（網站與 Writer 同一套規則）。
type SaveInput struct {
	Title           string  `json:"title"`
	Summary         string  `json:"summary"`
	Content         string  `json:"content"`
	Trigger         string  `json:"trigger"`
	BaseVersionID   *uint64 `json:"base_version_id"`
	AbortOnConflict bool    `json:"abort_on_conflict,omitempty"`
}

// AttributePatch 是編輯頁屬性列的即時異動；nil＝不變。GroupID 是冊（故事）或設定集（設定）的 public_id，
// 空字串代表移出冊／未歸類；ProfileIDs 只有故事有（0＝本人）。
type AttributePatch struct {
	Status     *string   `json:"status,omitempty"`
	GroupID    *string   `json:"group_id,omitempty"`
	ProfileIDs *[]uint64 `json:"profile_ids,omitempty"`
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
// 故事的 PUT 會整筆覆寫 status／sort（沒帶就變成預設值），所以先讀一次伺服器上目前的值再送，
// 避免把側邊列剛排好的順序或屬性列剛 PATCH 的狀態蓋回去；parent_id／profile_ids 省略就是不變。
// 設定的 status／collection_id 本來就是「省略＝不變更」，只送標題、摘要與內文。
func (c *Client) SaveDocument(ctx context.Context, project string, kind DocumentKind, id string, input SaveInput) (*SaveResult, error) {
	path, err := documentPath(project, kind, id)
	if err != nil {
		return nil, err
	}
	body := map[string]any{"title": input.Title, "summary": input.Summary, "content": input.Content, "save_trigger": input.Trigger, "base_version_id": input.BaseVersionID, "abort_on_conflict": input.AbortOnConflict}
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

// PatchDocument 即時改故事／設定的屬性（PATCH，不寫版本、不進編輯歷史，只記 audit）。
// 故事搬到另一冊時排到那一冊最後，跟側邊列「移動到冊」一致。
func (c *Client) PatchDocument(ctx context.Context, project string, kind DocumentKind, id string, patch AttributePatch) error {
	path, err := documentPath(project, kind, id)
	if err != nil {
		return err
	}
	body := map[string]any{}
	if patch.Status != nil {
		body["status"] = *patch.Status
	}
	if kind == KindLore {
		if patch.GroupID != nil {
			body["collection_id"] = *patch.GroupID
		}
	} else {
		if patch.GroupID != nil {
			sort, err := c.storyCount(ctx, project, *patch.GroupID)
			if err != nil {
				return err
			}
			body["parent_id"], body["sort"] = *patch.GroupID, sort
		}
		if patch.ProfileIDs != nil {
			body["profile_ids"] = *patch.ProfileIDs
		}
	}
	_, err = request[struct{}](ctx, c, http.MethodPatch, path, body)
	return err
}

// ImagePage 是圖像作品的一頁（作者端）：key／asset_public_id 存檔時原樣帶回去，ImageURL 是當下簽的預覽網址。
type ImagePage struct {
	ID            string `json:"id"`
	Key           string `json:"key"`
	AssetPublicID string `json:"asset_public_id"`
	ImageURL      string `json:"image_url"`
	Description   string `json:"description"`
	Sort          int    `json:"sort"`
}

func (c *Client) ImagePages(ctx context.Context, project, story string) ([]ImagePage, error) {
	return get[[]ImagePage](ctx, c, "/projects/"+project+"/stories/"+story+"/image-pages")
}

func (c *Client) Lores(ctx context.Context, project string) ([]EditorLore, error) {
	return get[[]EditorLore](ctx, c, "/projects/"+project+"/lores")
}

// Asset 回傳單一資產；preview_url 是有時效的簽名網址，前端快取要比網站的 45 分鐘刷新更短。
func (c *Client) Asset(ctx context.Context, project, id string) (*EditorAsset, error) {
	return get[*EditorAsset](ctx, c, "/projects/"+project+"/assets/"+id)
}
