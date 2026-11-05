package nekomaid

import (
	"fmt"
	"strings"
	"sync"
	"time"
	"unicode/utf8"

	"faryne.dev/model/entity/nekomaid"
	nekomaidRepo "faryne.dev/repository/nekomaid"
	"faryne.dev/service/search"
)

// 我的追蹤 → 畫師／標籤 tab：每位畫師（每個標籤）最多列幾件「前一次登入～本次登入」之間新增的作品
const favoriteNewArtworksSize = 12

// 收藏標籤的長度上限（users_fav_tags.tag 是 varchar(150)）
const favoriteTagMaxLength = 150

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
	from, to, err := loginWindow(userID)
	if err != nil {
		return nil, 0, err
	}
	fillNewArtworks(len(rows), func(i int) {
		row := &rows[i]
		row.Artworks = newArtworks(
			[]any{
				map[string]any{"match": map[string]any{"from": row.Site}},
				map[string]any{"match": map[string]any{"author_id": row.AuthorId}},
			},
			// match 只縮小範圍，最後以畫師 ID 完全相等為準
			func(a nekomaid.ArtworkSearchClearRow) bool { return a.AuthorId == row.AuthorId },
			from, to,
		)
	})
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

// SetFavoriteTag 收藏／取消收藏標籤
func SetFavoriteTag(userID uint64, tag string, on bool) error {
	tag = strings.TrimSpace(tag)
	if tag == "" || utf8.RuneCountInString(tag) > favoriteTagMaxLength {
		return invalidForbidden("標籤不能空白，最多 %d 字", favoriteTagMaxLength)
	}
	repo := nekomaidRepo.NewFavoriteRepository()
	if on {
		return repo.AddTag(userID, tag)
	}
	return repo.RemoveTag(userID, tag)
}

// ListFavoriteTags 收藏的標籤，每個附 published_dt 落在 (前一次登入, 本次登入] 且帶這個標籤的作品（規則同畫師）
func ListFavoriteTags(userID uint64, input nekomaid.FavoriteListRequest) ([]nekomaid.FavoriteTagItem, int64, error) {
	perPage := int(input.PerPageValue())
	rows, total, err := nekomaidRepo.NewFavoriteRepository().ListTags(userID, (int(input.PageValue())-1)*perPage, perPage)
	if err != nil {
		return nil, 0, err
	}
	from, to, err := loginWindow(userID)
	if err != nil {
		return nil, 0, err
	}
	fillNewArtworks(len(rows), func(i int) {
		row := &rows[i]
		// 比對方式跟前台標籤搜尋一致（tags.keyword 完全相等）
		row.Artworks = newArtworks(
			[]any{map[string]any{"match": map[string]any{"tags.keyword": row.Tag}}},
			func(nekomaid.ArtworkSearchClearRow) bool { return true },
			from, to,
		)
	})
	return rows, total, nil
}

// loginWindow 「新作品」的區間 (from, to]（Unix 秒）：前一次登入～本次登入；
// 第一次登入沒有前一次就是 0（不設下限，等同 published_dt > 0）；沒有本次（理論上不會）以現在為上限
func loginWindow(userID uint64) (int64, int64, error) {
	user, err := nekomaidRepo.NewUserRepository().ByID(userID)
	if err != nil {
		return 0, 0, err
	}
	var from int64
	if user.PreviousLoginAt != nil {
		from = user.PreviousLoginAt.Unix()
	}
	to := time.Now().Unix()
	if user.CurrentLoginAt != nil {
		to = user.CurrentLoginAt.Unix()
	}
	return from, to, nil
}

// fillNewArtworks 每一列各查一次 ES，並行跑（同時最多 5 個）
func fillNewArtworks(n int, fill func(i int)) {
	var wg sync.WaitGroup
	limit := make(chan struct{}, 5)
	for i := range n {
		wg.Add(1)
		go func() {
			defer wg.Done()
			limit <- struct{}{}
			defer func() { <-limit }()
			fill(i)
		}()
	}
	wg.Wait()
}

// newArtworks 符合 filters、published_dt 落在 (from, to] 的作品，新的在前，最多 favoriteNewArtworksSize 件；
// published_dt 是作品被抓進站內的時間（見 indexer.go）。keep 用來排除 match 分詞誤中的列。查不到就回空（畫面顯示「無作品」）
func newArtworks(filters []any, keep func(nekomaid.ArtworkSearchClearRow) bool, from, to int64) []nekomaid.ArtworkSearchClearRow {
	filters = append(filters, map[string]any{"range": map[string]any{"published_dt": map[string]any{"gt": from, "lte": to}}})
	_, rows, err := search.Search[nekomaid.ArtworkSearchResult, nekomaid.ArtworkSearchClearRow](
		"nekomaid",
		map[string]any{
			"size":  favoriteNewArtworksSize * 2,
			"sort":  nekomaidDefaultSort(),
			"query": map[string]any{"bool": map[string]any{"filter": filters}},
		},
		f,
	)
	out := make([]nekomaid.ArtworkSearchClearRow, 0, favoriteNewArtworksSize)
	if err != nil {
		return out
	}
	for _, row := range rows {
		if keep(row) && len(out) < favoriteNewArtworksSize {
			out = append(out, row)
		}
	}
	return out
}
