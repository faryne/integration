package av

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"strconv"
	"strings"

	"faryne.dev/config"
	"faryne.dev/model/enum"
	avRepo "faryne.dev/repository/av"
	"faryne.dev/service/client"
	"faryne.dev/service/log"
	"go.uber.org/zap"
)

// videoDelistedQuery 全區間回補（2026-11-03 完成）後仍帶 logstash @timestamp 的文件：Go 同步會整筆覆寫、不寫 @timestamp，
// 還留著就代表 DMM 每日清單已經撈不到（下架）。已標過 orphan 的排除，中斷後重跑會從還沒標的接著做
const videoDelistedQuery = `{"bool":{"filter":[{"exists":{"field":"@timestamp"}}],"must_not":[{"term":{"is_orphan":true}}]}}`

const videoDelistedBatch = 1000

// RunMarkDelistedVideosOrphan 一次性：把回補後確認下架的作品標成 orphan（MySQL＋ES），詳細頁不再顯示同步按鈕。
// 每批先標 MySQL 再標 ES；之後 DMM 又抓得到時，同步會整筆覆寫並自動清回 false
func RunMarkDelistedVideosOrphan() {
	if !videoWritesAllowed() {
		log.Logger().Error("Mark delisted videos orphan skipped: " + ErrVideoWritesDisabled.Error())
		return
	}
	ctx, repo, total := context.Background(), avRepo.NewDMMVideo(), 0
	for {
		ids, err := delistedVideoIDs(ctx)
		if err == nil && len(ids) == 0 {
			break
		}
		if err == nil {
			err = repo.MarkOrphan(ids)
		}
		if err == nil {
			err = markESOrphan(ctx, ids)
		}
		if err != nil {
			log.Logger().Error("Mark delisted videos orphan failed: "+err.Error(), zap.Int("marked", total))
			return
		}
		total += len(ids)
		log.Logger().Info("Mark delisted videos orphan progress", zap.Int("marked", total))
	}
	log.Logger().Info("Mark delisted videos orphan finished", zap.Int("marked", total))
}

// delistedVideoIDs 取下一批還沒標的文件 id（＝dmm.id）
func delistedVideoIDs(ctx context.Context) ([]int, error) {
	es := client.GetElasticSearch(enum.ESDefault)
	if es == nil {
		return nil, errors.New("elasticsearch client is not initialized")
	}
	body := fmt.Sprintf(`{"size":%d,"_source":false,"query":%s}`, videoDelistedBatch, videoDelistedQuery)
	resp, err := es.Search(
		es.Search.WithContext(ctx),
		es.Search.WithIndex(config.EnvConfig().DMMVideoIndex),
		es.Search.WithBody(strings.NewReader(body)),
	)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.IsError() {
		return nil, fmt.Errorf("search delisted videos failed: %s", resp.Status())
	}
	var r struct {
		Hits struct {
			Hits []struct {
				ID string `json:"_id"`
			} `json:"hits"`
		} `json:"hits"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&r); err != nil {
		return nil, err
	}
	ids := make([]int, 0, len(r.Hits.Hits))
	for _, h := range r.Hits.Hits {
		id, err := strconv.Atoi(h.ID)
		if err != nil {
			return nil, fmt.Errorf("unexpected dmm video document id %q", h.ID)
		}
		ids = append(ids, id)
	}
	return ids, nil
}

// markESOrphan 整批用 update_by_query 標 is_orphan；refresh 後下一批查詢才不會再撈到同一批。
// 實際更新筆數對不上就回錯，避免標不上時無窮迴圈
func markESOrphan(ctx context.Context, ids []int) error {
	es := client.GetElasticSearch(enum.ESDefault)
	if es == nil {
		return errors.New("elasticsearch client is not initialized")
	}
	// ids query 的值是字串（document id）
	strs := make([]string, len(ids))
	for i, id := range ids {
		strs[i] = strconv.Itoa(id)
	}
	values, _ := json.Marshal(strs)
	body := fmt.Sprintf(`{"query":{"ids":{"values":%s}},"script":{"source":"ctx._source.is_orphan = true","lang":"painless"}}`, values)
	resp, err := es.UpdateByQuery(
		[]string{config.EnvConfig().DMMVideoIndex},
		es.UpdateByQuery.WithContext(ctx),
		es.UpdateByQuery.WithBody(strings.NewReader(body)),
		es.UpdateByQuery.WithRefresh(true),
		es.UpdateByQuery.WithConflicts("proceed"),
	)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.IsError() {
		return fmt.Errorf("mark dmm videos orphan failed: %s", resp.Status())
	}
	// 版本衝突＝剛好被每日同步覆寫（已經不是舊文件），不用標，也算處理過
	var r struct {
		Updated   int `json:"updated"`
		Conflicts int `json:"version_conflicts"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&r); err != nil {
		return err
	}
	if r.Updated+r.Conflicts != len(ids) {
		return fmt.Errorf("mark dmm videos orphan updated %d of %d", r.Updated, len(ids))
	}
	return nil
}
