package av

import (
	"context"

	avRepo "faryne.dev/repository/av"
	"faryne.dev/service/log"
	"go.uber.org/zap"
)

const videoDelistedBatch = 1000

// RunMarkDelistedVideosOrphan 一次性：把回補後確認下架的作品標成 orphan（MySQL＋ES），詳細頁不再顯示同步按鈕。
// 每批先標 MySQL 再標搜尋索引；之後 DMM 又抓得到時，同步會整筆覆寫並自動清回 false
func RunMarkDelistedVideosOrphan() {
	if !videoWritesAllowed() {
		log.Logger().Error("Mark delisted videos orphan skipped: " + ErrVideoWritesDisabled.Error())
		return
	}
	// 「下架」的判斷（全區間回補後仍帶 logstash @timestamp 的文件）見 VideoIndex.NextDelistedVids
	ctx, repo, idx, total := context.Background(), avRepo.NewDMMVideo(), avRepo.NewVideoIndex(), 0
	for {
		ids, err := idx.NextDelistedVids(ctx, videoDelistedBatch)
		if err == nil && len(ids) == 0 {
			break
		}
		if err == nil {
			err = repo.MarkOrphan(ids)
		}
		if err == nil {
			err = idx.MarkOrphan(ctx, ids)
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
