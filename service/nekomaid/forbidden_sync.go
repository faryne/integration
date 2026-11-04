package nekomaid

import (
	"bytes"
	"cmp"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"slices"
	"time"

	"faryne.dev/config"
	"faryne.dev/model/entity/nekomaid"
	"faryne.dev/model/enum"
	nekomaidRepo "faryne.dev/repository/nekomaid"
	"faryne.dev/service/client"
	"faryne.dev/service/log"
	elasticsearch "github.com/elastic/go-elasticsearch/v7"
	"github.com/elastic/go-elasticsearch/v7/esapi"
	"go.uber.org/zap"
)

// forbiddenSyncBatchSize 每次排程最多處理幾筆禁抓；舊資料一次轉進來時分批處理，避免單次跑太久
const forbiddenSyncBatchSize = 20

// RunForbiddenSync 禁抓同步 job：讓 ES 跟禁抓名單一致。is_proceed = 0 的列依狀態處理——
//   - 生效中（is_deleted = 0）：把該畫師／作品從 ES 拉掉
//   - 已解除（is_deleted = 1）：用 artwork_main 的資料重新索引回 ES
//
// 只動 ES：原圖（S3）與 MySQL（artwork_main）一律保留，解除時才能原樣回補。
// 只在 production 跑——本機 .env 的 NEKOMAID_DSN 與 ES 都指向 prod，本機誤跑會真的改到線上索引。
func RunForbiddenSync() {
	if !config.EnvConfig().IsProduction() {
		log.Logger().Info("Skip nekomaid forbidden sync outside production")
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 4*time.Minute)
	defer cancel()

	repo := nekomaidRepo.NewForbiddenRepository()
	rows, err := repo.Pending(forbiddenSyncBatchSize)
	if err != nil {
		log.Logger().Error("Load pending nekomaid forbidden failed", zap.Error(err))
		return
	}
	for _, row := range rows {
		action, sync := "takedown", deleteIndexedArtworks
		if row.IsDeleted {
			action, sync = "restore", restoreIndexedArtworks
		}
		fields := []zap.Field{zap.Uint64("id", row.Id), zap.String("action", action),
			zap.String("site", string(row.Site)), zap.String("author_id", row.AuthorId), zap.String("artwork_id", row.ArtworkId)}
		if err := sync(ctx, row); err != nil {
			// 不標記完成，下一輪排程重試
			log.Logger().Error("Nekomaid forbidden sync failed", append(fields, zap.Error(err))...)
			continue
		}
		if err := repo.MarkProceed(row); err != nil {
			log.Logger().Error("Mark nekomaid forbidden proceed failed", append(fields, zap.Error(err))...)
			continue
		}
		log.Logger().Info("Nekomaid forbidden sync done", fields...)
	}
}

// restoreIndexedArtworks 解除禁抓後，把 artwork_main 裡未刪除的作品重新索引回 ES；
// 同一畫師若還有其他生效中的禁抓（例如解除整個畫師、但其中某件作品仍單獨被禁），那些作品跳過不回補。
func restoreIndexedArtworks(ctx context.Context, row nekomaid.ArtworkForbidden) error {
	repo := nekomaidRepo.NewForbiddenRepository()
	artworks, err := repo.RestorableArtworks(row)
	if err != nil {
		return err
	}
	for i := range artworks {
		artwork := &artworks[i]
		if forbidden, err := repo.IsForbidden(artwork.Site, artwork.AuthorId, artwork.ArtworkId); err != nil {
			return err
		} else if forbidden {
			continue
		}
		// 索引文件的 ID 與欄位取自 full_content，舊資料缺欄位時用 artwork_main 本身的值補上
		content := &artwork.FullContent
		content.From = cmp.Or(content.From, artwork.Site)
		content.AuthorId = cmp.Or(content.AuthorId, artwork.AuthorId)
		content.ArtworkId = cmp.Or(content.ArtworkId, artwork.ArtworkId)
		if err := IndexArtwork(ctx, artwork); err != nil {
			return err
		}
	}
	return nil
}

// deleteIndexedArtworks 把該畫師（或單一作品）的文件從 nekomaid 索引拉掉；直接查 ES 而不是依 artwork_main 逐筆刪，
// 連 DB 沒有對應列的舊文件也一起拉掉（這類文件解除後無法回補）。索引 mapping 不在 repo 裡，author_id 若是 text 欄位，
// 單靠 match 下 delete_by_query 可能誤刪別的畫師，所以先查出來、用 _source 精確比對後再依 _id 刪。
func deleteIndexedArtworks(ctx context.Context, row nekomaid.ArtworkForbidden) error {
	es := client.GetElasticSearch(enum.ESDefault)
	if es == nil {
		return fmt.Errorf("elasticsearch client is not initialized")
	}
	ids, err := indexedArtworkIDs(ctx, es, row)
	if err != nil || len(ids) == 0 {
		return err
	}
	for chunk := range slices.Chunk(ids, 1000) {
		var resp *esapi.Response
		resp, err = esRequest(es, map[string]any{"query": map[string]any{"ids": map[string]any{"values": chunk}}}, func(body io.Reader) (*esapi.Response, error) {
			return es.DeleteByQuery([]string{"nekomaid"}, body,
				es.DeleteByQuery.WithContext(ctx), es.DeleteByQuery.WithRefresh(true), es.DeleteByQuery.WithConflicts("proceed"))
		})
		if err != nil {
			return err
		}
		resp.Body.Close()
	}
	return nil
}

// takedownSearchPage／takedownSearchLimit 用 from/size 翻頁，最多看 ES 預設 max_result_window 的 1 萬筆
const (
	takedownSearchPage  = 500
	takedownSearchLimit = 10000
)

// indexedArtworkIDs 找出禁抓目標在索引中的文件 _id；match 只用來縮小範圍，最後以 _source 完全相等為準
func indexedArtworkIDs(ctx context.Context, es *elasticsearch.Client, row nekomaid.ArtworkForbidden) ([]string, error) {
	ids := make([]string, 0)
	for from := 0; from < takedownSearchLimit; from += takedownSearchPage {
		query := map[string]any{
			"query":   takedownQuery(row),
			"_source": []string{"from", "author_id", "artwork_id"},
			"sort":    []any{"_doc"},
			"from":    from,
			"size":    takedownSearchPage,
		}
		resp, err := esRequest(es, query, func(body io.Reader) (*esapi.Response, error) {
			return es.Search(es.Search.WithContext(ctx), es.Search.WithIndex("nekomaid"), es.Search.WithBody(body))
		})
		if err != nil {
			return nil, err
		}
		var result struct {
			Hits struct {
				Hits []struct {
					ID     string         `json:"_id"`
					Source map[string]any `json:"_source"`
				} `json:"hits"`
			} `json:"hits"`
		}
		decoder := json.NewDecoder(resp.Body)
		decoder.UseNumber() // 舊文件的 ID 可能存成數字，保留原樣再轉字串比對
		err = decoder.Decode(&result)
		resp.Body.Close()
		if err != nil {
			return nil, err
		}
		for _, hit := range result.Hits.Hits {
			if isTakedownTarget(row, hit.Source) {
				ids = append(ids, hit.ID)
			}
		}
		if len(result.Hits.Hits) < takedownSearchPage {
			break
		}
	}
	return ids, nil
}

// isTakedownTarget 索引文件的站台、畫師（、作品）跟禁抓目標完全相等
func isTakedownTarget(row nekomaid.ArtworkForbidden, source map[string]any) bool {
	field := func(key string) string { return fmt.Sprint(source[key]) }
	return field("from") == string(row.Site) && field("author_id") == row.AuthorId &&
		(row.ArtworkId == "" || field("artwork_id") == row.ArtworkId)
}

// esRequest 把 body 編成 JSON 送出，非 2xx 一律轉成錯誤；成功時呼叫端負責關 resp.Body
func esRequest(es *elasticsearch.Client, body any, send func(io.Reader) (*esapi.Response, error)) (*esapi.Response, error) {
	raw, err := json.Marshal(body)
	if err != nil {
		return nil, err
	}
	resp, err := send(bytes.NewReader(raw))
	if err != nil {
		return nil, err
	}
	if resp.IsError() {
		defer resp.Body.Close()
		detail, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("nekomaid takedown elasticsearch request failed: status=%s body=%s", resp.Status(), detail)
	}
	return resp, nil
}

// takedownQuery 縮小搜尋範圍用，欄位比對方式跟前台搜尋（service/nekomaid/search.go）一致
func takedownQuery(row nekomaid.ArtworkForbidden) map[string]any {
	filters := []any{
		map[string]any{"match": map[string]any{"from": row.Site}},
		map[string]any{"match": map[string]any{"author_id": row.AuthorId}},
	}
	if row.ArtworkId != "" {
		filters = append(filters, map[string]any{"match": map[string]any{"artwork_id": row.ArtworkId}})
	}
	return map[string]any{"bool": map[string]any{"filter": filters}}
}
