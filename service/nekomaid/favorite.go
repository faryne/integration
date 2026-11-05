package nekomaid

import (
	"fmt"
	"strings"
	"sync"
	"time"

	"faryne.dev/model/entity/nekomaid"
	nekomaidRepo "faryne.dev/repository/nekomaid"
	"faryne.dev/service/search"
)

// 我的追蹤 → 畫師 tab：每位畫師最多列幾件「前一次登入～本次登入」之間新增的作品
const favoriteAuthorNewArtworksSize = 12

// FavoriteKeys 使用者全部收藏的 key（畫愛心、追蹤按鈕狀態用）
func FavoriteKeys(userID uint64) (nekomaid.FavoriteKeys, error) {
	return nekomaidRepo.NewFavoriteRepository().Keys(userID)
}

// SetFavoriteAuthor 追蹤／取消追蹤畫師
func SetFavoriteAuthor(userID uint64, site, authorID string, on bool) error {
	cleanSite, cleanAuthor, _, err := normalizeForbiddenTarget(site, authorID, "")
	if err != nil {
		return err
	}
	if cleanAuthor == "" {
		return invalidForbidden("缺少畫師 ID")
	}
	repo := nekomaidRepo.NewFavoriteRepository()
	if on {
		return repo.AddAuthor(userID, string(cleanSite), cleanAuthor)
	}
	return repo.RemoveAuthor(userID, string(cleanSite), cleanAuthor)
}

// SetFavoriteArtwork 收藏／取消收藏作品
func SetFavoriteArtwork(userID uint64, site, authorID, artworkID string, on bool) error {
	cleanSite, cleanAuthor, cleanArtwork, err := normalizeForbiddenTarget(site, authorID, artworkID)
	if err != nil {
		return err
	}
	if cleanAuthor == "" || cleanArtwork == "" {
		return invalidForbidden("缺少畫師或作品 ID")
	}
	repo := nekomaidRepo.NewFavoriteRepository()
	if on {
		return repo.AddArtwork(userID, string(cleanSite), cleanAuthor, cleanArtwork)
	}
	return repo.RemoveArtwork(userID, string(cleanSite), cleanAuthor, cleanArtwork)
}

// ListFavoriteAuthors 追蹤的畫師（禁抓中的不列），每位附 published_dt 落在 (前一次登入, 本次登入] 的新作品，最多 12 件；
// 第一次登入（沒有前一次）就不設下限，等同 published_dt > 0，直接列最新的。ES 查詢並行跑
func ListFavoriteAuthors(userID uint64, input nekomaid.FavoriteListRequest) ([]nekomaid.FavoriteAuthorItem, int64, error) {
	perPage := int(input.PerPageValue())
	rows, total, err := nekomaidRepo.NewFavoriteRepository().ListAuthors(userID, (int(input.PageValue())-1)*perPage, perPage)
	if err != nil {
		return nil, 0, err
	}
	user, err := nekomaidRepo.NewUserRepository().ByID(userID)
	if err != nil {
		return nil, 0, err
	}
	for i := range rows {
		rows[i].Artworks = []nekomaid.ArtworkSearchClearRow{}
	}
	var from int64 // 0＝第一次登入，不設下限
	if user.PreviousLoginAt != nil {
		from = user.PreviousLoginAt.Unix()
	}
	to := time.Now().Unix() // 理論上登入都會記本次時間，沒有就以現在為上限
	if user.CurrentLoginAt != nil {
		to = user.CurrentLoginAt.Unix()
	}
	var wg sync.WaitGroup
	limit := make(chan struct{}, 5) // 同時最多 5 個 ES 查詢
	for i := range rows {
		wg.Add(1)
		go func(row *nekomaid.FavoriteAuthorItem) {
			defer wg.Done()
			limit <- struct{}{}
			defer func() { <-limit }()
			// 查不到不影響列表，空著就好（畫面顯示「無作品」）
			if artworks, err := newAuthorArtworks(row.Site, row.AuthorId, from, to); err == nil {
				row.Artworks = artworks
			}
		}(&rows[i])
	}
	wg.Wait()
	return rows, total, nil
}

// ListFavoriteArtworks 收藏的作品（禁抓中的不列），依收藏時間新到舊；ES 已沒有的作品略過
func ListFavoriteArtworks(userID uint64, input nekomaid.FavoriteListRequest) ([]nekomaid.ArtworkSearchClearRow, int64, error) {
	perPage := int(input.PerPageValue())
	favorites, total, err := nekomaidRepo.NewFavoriteRepository().ListArtworks(userID, (int(input.PageValue())-1)*perPage, perPage)
	if err != nil || len(favorites) == 0 {
		return []nekomaid.ArtworkSearchClearRow{}, total, err
	}
	ids := make([]string, len(favorites))
	for i, fav := range favorites {
		ids[i] = strings.Join([]string{fav.Site, fav.AuthorId, fav.ArtworkId}, "-")
	}
	_, found, err := search.Search[nekomaid.ArtworkSearchResult, nekomaid.ArtworkSearchClearRow](
		"nekomaid",
		map[string]any{"size": len(ids), "query": map[string]any{"ids": map[string]any{"values": ids}}},
		f,
	)
	if err != nil {
		return nil, 0, fmt.Errorf("get favorite nekomaid artworks: %w", err)
	}
	// ES 回來的順序不固定，照收藏順序排回去
	byID := make(map[string]nekomaid.ArtworkSearchClearRow, len(found))
	for _, row := range found {
		byID[strings.Join([]string{strings.ToLower(row.From), row.AuthorId, row.ArtworkId}, "-")] = row
	}
	rows := make([]nekomaid.ArtworkSearchClearRow, 0, len(ids))
	for _, id := range ids {
		if row, ok := byID[id]; ok {
			rows = append(rows, row)
		}
	}
	return rows, total, nil
}

// newAuthorArtworks 畫師在 (from, to]（Unix 秒）之間新增到站內的作品，新的在前。
// published_dt 是作品被抓進站內的時間（見 indexer.go）；match 只縮小範圍，最後以畫師 ID 完全相等為準
func newAuthorArtworks(site, authorID string, from, to int64) ([]nekomaid.ArtworkSearchClearRow, error) {
	_, rows, err := search.Search[nekomaid.ArtworkSearchResult, nekomaid.ArtworkSearchClearRow](
		"nekomaid",
		map[string]any{
			"size": favoriteAuthorNewArtworksSize * 2,
			"sort": nekomaidDefaultSort(),
			"query": map[string]any{"bool": map[string]any{"filter": []any{
				map[string]any{"match": map[string]any{"from": site}},
				map[string]any{"match": map[string]any{"author_id": authorID}},
				map[string]any{"range": map[string]any{"published_dt": map[string]any{"gt": from, "lte": to}}},
			}}},
		},
		f,
	)
	if err != nil {
		return nil, err
	}
	out := make([]nekomaid.ArtworkSearchClearRow, 0, favoriteAuthorNewArtworksSize)
	for _, row := range rows {
		if row.AuthorId == authorID && len(out) < favoriteAuthorNewArtworksSize {
			out = append(out, row)
		}
	}
	return out, nil
}
