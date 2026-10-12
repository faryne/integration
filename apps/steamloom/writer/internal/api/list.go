package api

import (
	"context"
	"fmt"
	"slices"
)

// ListedDocument 是「全部作品／全部設定」列表的一列，欄位對應網站工作台列表顯示的資訊。
type ListedDocument struct {
	Kind        DocumentKind `json:"kind"`
	PublicID    string       `json:"public_id"`
	Title       string       `json:"title"`
	ContentType string       `json:"content_type"`
	Status      string       `json:"status"`
	WordCount   uint         `json:"word_count"`
	UpdatedAt   string       `json:"updated_at"`
	// GroupName 是所屬的冊／設定集名稱，未分冊／未歸類為空字串
	GroupName string `json:"group_name"`
}

type listedRow struct {
	PublicID     string  `json:"public_id"`
	ParentID     *uint64 `json:"parent_id"`
	CollectionID string  `json:"collection_id"`
	IsVolume     bool    `json:"is_volume"`
	ContentType  string  `json:"content_type"`
	Title        string  `json:"title"`
	Status       string  `json:"status"`
	Sort         int     `json:"sort"`
	WordCount    uint    `json:"word_count"`
	UpdatedAt    string  `json:"updated_at"`
}

// ListDocuments 列出專案全部的故事（不含冊）或設定，附上所屬分組名稱；故事依冊的順序、冊內 sort 排。
func (c *Client) ListDocuments(ctx context.Context, project string, kind DocumentKind) ([]ListedDocument, error) {
	base := "/projects/" + project
	switch kind {
	case KindStory:
		stories, err := get[[]listedRow](ctx, c, base+"/stories")
		if err != nil {
			return nil, err
		}
		volumes, err := get[[]storyRow](ctx, c, base+"/volumes")
		if err != nil {
			return nil, err
		}
		slices.SortStableFunc(volumes, func(a, b storyRow) int { return a.Sort - b.Sort })
		volumeName, volumeOrder := map[uint64]string{}, map[uint64]int{}
		for i, volume := range volumes {
			volumeName[volume.ID], volumeOrder[volume.ID] = volume.Title, i
		}
		// 未分冊排在最後，跟側邊列一致
		order := func(row listedRow) int {
			if row.ParentID == nil {
				return len(volumes)
			}
			return volumeOrder[*row.ParentID]
		}
		slices.SortStableFunc(stories, func(a, b listedRow) int {
			if order(a) != order(b) {
				return order(a) - order(b)
			}
			return a.Sort - b.Sort
		})
		var out []ListedDocument
		for _, row := range stories {
			if row.IsVolume {
				continue
			}
			group := ""
			if row.ParentID != nil {
				group = volumeName[*row.ParentID]
			}
			out = append(out, toListed(KindStory, row, group))
		}
		return out, nil
	case KindLore:
		lores, err := get[[]listedRow](ctx, c, base+"/lores")
		if err != nil {
			return nil, err
		}
		collections, err := get[[]collectionRow](ctx, c, base+"/lore-collections")
		if err != nil {
			return nil, err
		}
		collectionName := map[string]string{}
		for _, collection := range collections {
			collectionName[collection.PublicID] = collection.Name
		}
		out := make([]ListedDocument, 0, len(lores))
		for _, row := range lores {
			out = append(out, toListed(KindLore, row, collectionName[row.CollectionID]))
		}
		return out, nil
	}
	return nil, fmt.Errorf("unknown document kind: %s", kind)
}

func toListed(kind DocumentKind, row listedRow, group string) ListedDocument {
	return ListedDocument{
		Kind: kind, PublicID: row.PublicID, Title: row.Title, ContentType: row.ContentType,
		Status: row.Status, WordCount: row.WordCount, UpdatedAt: row.UpdatedAt, GroupName: group,
	}
}
