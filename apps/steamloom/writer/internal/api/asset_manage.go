package api

import (
	"context"
	"net/http"
)

// 資產與資產集的管理操作，對應網站工作台的資產詳細頁、卡片選單、資產集編輯／刪除。

// AssetInput 是資產詳細頁可以改的欄位；metadata 原樣帶回去，後端整筆覆寫。
type AssetInput struct {
	Title       string         `json:"title"`
	AltText     string         `json:"alt_text"`
	Description string         `json:"description"`
	Metadata    map[string]any `json:"metadata"`
}

func assetPath(project, asset string) string { return "/projects/" + project + "/assets/" + asset }

func (c *Client) UpdateAsset(ctx context.Context, project, asset string, input AssetInput) (*Asset, error) {
	if input.Metadata == nil {
		input.Metadata = map[string]any{}
	}
	return request[*Asset](ctx, c, http.MethodPut, assetPath(project, asset), input)
}

// MoveAsset 搬到另一個資產集；collection 空字串＝移到未分類。
func (c *Client) MoveAsset(ctx context.Context, project, asset, collection string) (*Asset, error) {
	return request[*Asset](ctx, c, http.MethodPut, assetPath(project, asset)+"/move", map[string]string{"collection_id": collection})
}

// DeleteAsset 刪除資產；仍被作品引用時後端會拒絕，錯誤訊息直接給前端顯示。
func (c *Client) DeleteAsset(ctx context.Context, project, asset string) error {
	_, err := request[struct{}](ctx, c, http.MethodDelete, assetPath(project, asset), nil)
	return err
}

// UpdateAssetCollection 改資產集的名稱與用途筆記（網站 CollectionDialog 的兩個欄位）。
// 後端會整筆覆寫 sort（沒帶就變 0、順序亂掉），所以先讀目前的 sort 再一起送，跟網站帶 target.sort 一樣。
func (c *Client) UpdateAssetCollection(ctx context.Context, project, collection, name, description string) error {
	base := "/projects/" + project + "/asset-collections"
	rows, err := get[[]struct {
		PublicID string `json:"public_id"`
		Sort     int    `json:"sort"`
	}](ctx, c, base)
	if err != nil {
		return err
	}
	sort := 0
	for _, row := range rows {
		if row.PublicID == collection {
			sort = row.Sort
		}
	}
	_, err = request[struct{}](ctx, c, http.MethodPut, base+"/"+collection, map[string]any{"name": name, "description": description, "sort": sort})
	return err
}

func (c *Client) DeleteAssetCollection(ctx context.Context, project, collection string) error {
	_, err := request[struct{}](ctx, c, http.MethodDelete, "/projects/"+project+"/asset-collections/"+collection, nil)
	return err
}
