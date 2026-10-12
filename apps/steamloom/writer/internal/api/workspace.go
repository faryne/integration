package api

import (
	"context"
	"slices"
	"sync"
)

// DocumentKind 區分故事與設定；兩者在 Writer 裡共用同一套分頁（對話／編輯／歷史）。
type DocumentKind string

const (
	KindStory DocumentKind = "story"
	KindLore  DocumentKind = "lore"
)

// DocumentItem 是側邊列上的一篇故事或設定。
type DocumentItem struct {
	Kind        DocumentKind `json:"kind"`
	PublicID    string       `json:"public_id"`
	Title       string       `json:"title"`
	ContentType string       `json:"content_type"`
}

// Group 是側邊列上的一個分組（冊／設定集／資產集），Items 為空代表不展開。
type Group struct {
	PublicID string         `json:"public_id"`
	Name     string         `json:"name"`
	Items    []DocumentItem `json:"items"`
}

// Workspace 是專案工作台側邊列的完整樹狀資料，在 Go 端組好，前端只負責畫。
type Workspace struct {
	Volumes            []Group        `json:"volumes"`
	UngroupedStories   []DocumentItem `json:"ungrouped_stories"`
	LoreCollections    []Group        `json:"lore_collections"`
	UncategorizedLores []DocumentItem `json:"uncategorized_lores"`
	AssetCollections   []Group        `json:"asset_collections"`
}

// 後端回傳的原始列，只取組樹需要的欄位。
type storyRow struct {
	ID          uint64  `json:"id"`
	PublicID    string  `json:"public_id"`
	ParentID    *uint64 `json:"parent_id"`
	IsVolume    bool    `json:"is_volume"`
	ContentType string  `json:"content_type"`
	Title       string  `json:"title"`
	Sort        int     `json:"sort"`
}

type loreRow struct {
	PublicID     string `json:"public_id"`
	CollectionID string `json:"collection_id"`
	Title        string `json:"title"`
}

type collectionRow struct {
	PublicID    string `json:"public_id"`
	Name        string `json:"name"`
	Description string `json:"description"`
	Sort        int    `json:"sort"`
}

// Workspace 平行抓故事、冊、設定、設定集、資產集，再依 parent_id／collection_id 分組。
func (c *Client) Workspace(ctx context.Context, project string) (*Workspace, error) {
	base := "/projects/" + project
	var (
		stories, volumes             []storyRow
		lores                        []loreRow
		loreCollections, assetGroups []collectionRow
		wg                           sync.WaitGroup
		mu                           sync.Mutex
		errs                         []error
	)
	fetch := func(f func() error) {
		wg.Go(func() {
			if err := f(); err != nil {
				mu.Lock()
				errs = append(errs, err)
				mu.Unlock()
			}
		})
	}
	fetch(func() (err error) { stories, err = get[[]storyRow](ctx, c, base+"/stories"); return })
	fetch(func() (err error) { volumes, err = get[[]storyRow](ctx, c, base+"/volumes"); return })
	fetch(func() (err error) { lores, err = get[[]loreRow](ctx, c, base+"/lores"); return })
	fetch(func() (err error) {
		loreCollections, err = get[[]collectionRow](ctx, c, base+"/lore-collections")
		return
	})
	fetch(func() (err error) { assetGroups, err = get[[]collectionRow](ctx, c, base+"/asset-collections"); return })
	wg.Wait()
	if err := joinErrors(errs); err != nil {
		return nil, err
	}
	return buildWorkspace(stories, volumes, lores, loreCollections, assetGroups), nil
}

func buildWorkspace(stories, volumes []storyRow, lores []loreRow, loreCollections, assetGroups []collectionRow) *Workspace {
	bySort := func(a, b storyRow) int { return a.Sort - b.Sort }
	slices.SortStableFunc(stories, bySort)
	slices.SortStableFunc(volumes, bySort)
	slices.SortStableFunc(loreCollections, func(a, b collectionRow) int { return a.Sort - b.Sort })
	slices.SortStableFunc(assetGroups, func(a, b collectionRow) int { return a.Sort - b.Sort })

	ws := &Workspace{}
	// 故事依所屬的冊分組；冊本身（is_volume）不當成文件
	storiesByVolume := map[uint64][]DocumentItem{}
	for _, row := range stories {
		if row.IsVolume {
			continue
		}
		item := DocumentItem{Kind: KindStory, PublicID: row.PublicID, Title: row.Title, ContentType: row.ContentType}
		if row.ParentID == nil {
			ws.UngroupedStories = append(ws.UngroupedStories, item)
		} else {
			storiesByVolume[*row.ParentID] = append(storiesByVolume[*row.ParentID], item)
		}
	}
	for _, volume := range volumes {
		ws.Volumes = append(ws.Volumes, Group{PublicID: volume.PublicID, Name: volume.Title, Items: storiesByVolume[volume.ID]})
	}
	// 設定依設定集分組
	loresByCollection := map[string][]DocumentItem{}
	for _, row := range lores {
		item := DocumentItem{Kind: KindLore, PublicID: row.PublicID, Title: row.Title}
		if row.CollectionID == "" {
			ws.UncategorizedLores = append(ws.UncategorizedLores, item)
		} else {
			loresByCollection[row.CollectionID] = append(loresByCollection[row.CollectionID], item)
		}
	}
	for _, collection := range loreCollections {
		ws.LoreCollections = append(ws.LoreCollections, Group{PublicID: collection.PublicID, Name: collection.Name, Items: loresByCollection[collection.PublicID]})
	}
	for _, collection := range assetGroups {
		ws.AssetCollections = append(ws.AssetCollections, Group{PublicID: collection.PublicID, Name: collection.Name})
	}
	return ws
}
