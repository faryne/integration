package api

import (
	"context"
	"errors"
	"fmt"
	"net/http"
)

// 網站「建立」選單裡的項目；Writer 比照網站全部提供。
const (
	CreateStory           = "story"
	CreateImageStory      = "image"
	CreateVolume          = "volume"
	CreateLore            = "lore"
	CreateLoreCollection  = "lore-collection"
	CreateAssetCollection = "asset-collection"
)

// CreateRequest 是側邊列「建立」對話框送來的資料。
type CreateRequest struct {
	Kind string `json:"kind"`
	Name string `json:"name"`
	// GroupPublicID：故事／圖像作品建在哪一冊、設定建在哪個設定集；空字串代表未分冊／未歸類
	GroupPublicID string `json:"group_public_id"`
}

// Created 回傳新項目；Kind 只有故事類（story）與設定（lore）會填，前端據此打開它，冊與各種集只需重新整理。
type Created struct {
	Kind     DocumentKind `json:"kind"`
	PublicID string       `json:"public_id"`
}

type createdRow struct {
	PublicID string `json:"public_id"`
}

// Create 依 Kind 打對應的建立 API；新項目排在所屬分組最後，跟網站的行為一致。
func (c *Client) Create(ctx context.Context, project string, req CreateRequest) (*Created, error) {
	base := "/projects/" + project
	switch req.Kind {
	case CreateStory, CreateImageStory:
		sort, err := c.storyCount(ctx, project, req.GroupPublicID)
		if err != nil {
			return nil, err
		}
		contentType := "text"
		if req.Kind == CreateImageStory {
			contentType = "image"
		}
		row, err := request[createdRow](ctx, c, http.MethodPost, base+"/stories", map[string]any{
			"title": req.Name, "summary": "", "status": "draft", "sort": sort, "content": "",
			"content_type": contentType, "parent_id": req.GroupPublicID,
		})
		return &Created{Kind: KindStory, PublicID: row.PublicID}, err
	case CreateVolume:
		volumes, err := get[[]storyRow](ctx, c, base+"/volumes")
		if err != nil {
			return nil, err
		}
		row, err := request[createdRow](ctx, c, http.MethodPost, base+"/volumes", map[string]any{
			"title": req.Name, "summary": "", "status": "draft", "sort": len(volumes),
		})
		return &Created{PublicID: row.PublicID}, err
	case CreateLore:
		body := map[string]any{"title": req.Name, "content": ""}
		if req.GroupPublicID != "" {
			body["collection_id"] = req.GroupPublicID
		}
		row, err := request[createdRow](ctx, c, http.MethodPost, base+"/lores", body)
		return &Created{Kind: KindLore, PublicID: row.PublicID}, err
	case CreateLoreCollection, CreateAssetCollection:
		path := base + "/lore-collections"
		if req.Kind == CreateAssetCollection {
			path = base + "/asset-collections"
		}
		collections, err := get[[]collectionRow](ctx, c, path)
		if err != nil {
			return nil, err
		}
		row, err := request[createdRow](ctx, c, http.MethodPost, path, map[string]any{
			"name": req.Name, "description": "", "sort": len(collections),
		})
		return &Created{PublicID: row.PublicID}, err
	}
	return nil, fmt.Errorf("unknown create kind: %s", req.Kind)
}

// storyCount 算某一冊（空字串＝未分冊）目前有幾篇故事，新建或移入的故事排在最後。
func (c *Client) storyCount(ctx context.Context, project, volume string) (int, error) {
	stories, err := get[[]storyRow](ctx, c, "/projects/"+project+"/stories")
	if err != nil {
		return 0, err
	}
	parentID, err := c.volumeID(ctx, project, volume)
	if err != nil {
		return 0, err
	}
	count := 0
	for _, story := range stories {
		if !story.IsVolume && sameParent(story.ParentID, parentID) {
			count++
		}
	}
	return count, nil
}

// volumeID 把冊的 public_id 轉成內部 id（故事列表的 parent_id 用的是內部 id）；空字串回 nil。
func (c *Client) volumeID(ctx context.Context, project, volume string) (*uint64, error) {
	if volume == "" {
		return nil, nil
	}
	volumes, err := get[[]storyRow](ctx, c, "/projects/"+project+"/volumes")
	if err != nil {
		return nil, err
	}
	for _, row := range volumes {
		if row.PublicID == volume {
			return &row.ID, nil
		}
	}
	return nil, errors.New("找不到這一冊，請重新整理後再試")
}

func sameParent(a, b *uint64) bool {
	return (a == nil && b == nil) || (a != nil && b != nil && *a == *b)
}

// MoveStory 把故事移到某一冊（空字串＝未分冊）並排到最後；走 PATCH，不寫版本、不送內文。
func (c *Client) MoveStory(ctx context.Context, project, story, volume string) error {
	sort, err := c.storyCount(ctx, project, volume)
	if err != nil {
		return err
	}
	_, err = request[createdRow](ctx, c, http.MethodPatch, "/projects/"+project+"/stories/"+story, map[string]any{
		"parent_id": volume, "sort": sort,
	})
	return err
}

// MoveLore 把設定移到某個設定集（空字串＝未歸類）；設定沒有排序欄位。
func (c *Client) MoveLore(ctx context.Context, project, lore, collection string) error {
	_, err := request[createdRow](ctx, c, http.MethodPut, "/projects/"+project+"/lores/"+lore+"/move", map[string]any{
		"collection_id": collection,
	})
	return err
}

// 可以排序的對象；設定本身沒有 sort 欄位，不能排。
const (
	ReorderVolumes         = "volumes"
	ReorderStories         = "stories"
	ReorderLoreCollections = "lore-collections"
)

// Reorder 依 ids 的順序重設 sort，只送真的變動的那幾筆。故事與冊走 PATCH（不寫版本）；
// 設定集的更新 API 要完整欄位，所以帶上原本的名稱與說明。
func (c *Client) Reorder(ctx context.Context, project, kind string, ids []string) error {
	base := "/projects/" + project
	var errs []error
	switch kind {
	case ReorderVolumes, ReorderStories:
		rows, err := get[[]storyRow](ctx, c, base+"/"+kind)
		if err != nil {
			return err
		}
		current := map[string]int{}
		for _, row := range rows {
			current[row.PublicID] = row.Sort
		}
		for index, id := range ids {
			if sort, ok := current[id]; ok && sort == index {
				continue
			}
			_, err := request[createdRow](ctx, c, http.MethodPatch, base+"/stories/"+id, map[string]any{"sort": index})
			errs = append(errs, err)
		}
	case ReorderLoreCollections:
		rows, err := get[[]collectionRow](ctx, c, base+"/lore-collections")
		if err != nil {
			return err
		}
		current := map[string]collectionRow{}
		for _, row := range rows {
			current[row.PublicID] = row
		}
		for index, id := range ids {
			row, ok := current[id]
			if !ok || row.Sort == index {
				continue
			}
			_, err := request[createdRow](ctx, c, http.MethodPut, base+"/lore-collections/"+id, map[string]any{
				"name": row.Name, "description": row.Description, "sort": index,
			})
			errs = append(errs, err)
		}
	default:
		return fmt.Errorf("unknown reorder kind: %s", kind)
	}
	return joinErrors(errs)
}
