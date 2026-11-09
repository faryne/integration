package av

import (
	"context"
	"errors"
	"fmt"
	"strconv"
	"strings"
	"time"

	avEntity "faryne.dev/model/entity/opendata/av"
	avRepo "faryne.dev/repository/av"
	"faryne.dev/service/dmm"
	"faryne.dev/service/log"

	"go.uber.org/zap"
)

// 即將發售（joyu.fyi）：每天抓 DMM 未來 30 天的預約作品，跟已配信的一樣寫進 MySQL dmm＋影片索引（persistVideos），
// 帶 release_status = PRE_ORDER（依配信日設）與 fetched_at；配信當天每日同步用同一個番號覆寫同一筆，這兩個欄位跟著消失，不用另外刪。
// 規格見 DevelopDocuments/opendata/joyu.fyi社群功能第二期_2026-11-09.md 第三節
//   - 清單上新出現的抓明細；抓過的 7 天內不重抓，剩 3 天內配信的超過一天就重抓（預約作品常改標題、改日期）
//   - 排程寫過（有 fetched_at）、這次清單上卻沒有的（取消或改期）：用番號重抓明細，DMM 回新日期就覆寫，查無才刪除。
//     配信日是今天的不管（由當天 10:00 的同步覆寫）；改期到範圍外的不管（進到範圍內會再出現在清單上）
//   - 只在正式環境、或 DMM_VIDEO_INDEX 換成測試索引時寫入（跟每日同步同一道檢查）

const (
	upcomingDays         = 30
	upcomingRefetchAfter = 7 * 24 * time.Hour
	upcomingSoonWithin   = 3 * 24 * time.Hour
	upcomingSoonRefetch  = 24 * time.Hour
	// 一天的預約作品大約 5～8 頁，上限只是防 DMM 分頁異常時無窮迴圈
	upcomingMaxPages = 50
	// 明細與翻頁之間喘口氣，跟每日同步一樣壓低請求頻率
	upcomingDetailDelay = 300 * time.Millisecond
	upcomingPageDelay   = time.Second
)

var errUpcomingEmpty = errors.New("DMM 預約清單一部都沒有，可能是對方改了 schema，這次不重抓也不刪任何資料")

type UpcomingSyncResult struct {
	Listed  int // 清單上的作品數
	Fetched int // 抓了明細並寫入
	Kept    int // 最近抓過，沿用
	Failed  int // 明細抓不到或沒有配信日，略過
	Deleted int // 預約中卻已經查無（取消），刪掉
}

// needUpcomingRefetch 已在索引裡的預約作品要不要重抓明細
func needUpcomingRefetch(doc avEntity.VideoPreOrder, vodDate, now time.Time) bool {
	fetched, err := time.Parse(time.RFC3339, doc.FetchedAt)
	if err != nil {
		return true
	}
	age := now.Sub(fetched)
	return age > upcomingRefetchAfter || (vodDate.Sub(now) < upcomingSoonWithin && age > upcomingSoonRefetch)
}

// SyncUpcomingVideos 同步明天起 days 天。任何一天的清單抓不到就整個中止，避免 DMM 暫時出錯時把預約作品誤判成取消
func SyncUpcomingVideos(ctx context.Context, days int) (UpcomingSyncResult, error) {
	var result UpcomingSyncResult
	if !videoWritesAllowed() {
		return result, ErrVideoWritesDisabled
	}
	idx := avRepo.NewVideoIndex()
	existing, err := idx.PreOrders(ctx)
	if err != nil {
		return result, fmt.Errorf("load pre-orders: %w", err)
	}
	client := dmm.NewDMMClient()
	now := time.Now().In(jst)
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, jst)
	days = min(max(days, 1), upcomingDays)
	lastDay := today.AddDate(0, 0, days)

	// 1. 翻清單：要抓明細的番號 → DMM 收藏數
	toFetch := map[string]int{}
	for d := 1; d <= days; d++ {
		day := today.AddDate(0, 0, d)
		date := day.Format(time.DateOnly)
		for page := 1; page <= upcomingMaxPages; page++ {
			if err := ctx.Err(); err != nil {
				return result, err
			}
			items, hasNext, err := client.ListUpcoming(date, page)
			if err != nil {
				return result, fmt.Errorf("list %s page %d: %w", date, page, err)
			}
			for _, it := range items {
				no := strings.ToLower(it.No)
				result.Listed++
				// 配信日跟索引裡的不同（改期但還在範圍內）一定重抓
				if doc, ok := existing[no]; ok && doc.VodDate == day.Format("2006/01/02") && !needUpcomingRefetch(doc, day, now) {
					result.Kept++
					delete(existing, no)
					continue
				}
				toFetch[no] = it.BookmarkCount
				delete(existing, no)
			}
			if !hasNext {
				break
			}
			time.Sleep(upcomingPageDelay)
		}
	}
	if result.Listed == 0 {
		return result, errUpcomingEmpty
	}

	// 2. 排程寫過、這次清單上卻沒有的：配信日已過或在範圍內的重抓明細確認（今天的、範圍外的不管）
	vids := map[string]int{}
	for no, doc := range existing {
		vod, err := time.ParseInLocation("2006/01/02", doc.VodDate, jst)
		if err == nil && (vod.Equal(today) || vod.After(lastDay)) {
			continue
		}
		toFetch[no], vids[no] = 0, doc.Vid
	}

	// 3. 抓明細並寫入（跟每日同步同一條路）；查無的刪掉
	repo := avRepo.NewDMMVideo()
	for no, bookmark := range toFetch {
		if err := ctx.Err(); err != nil {
			return result, err
		}
		v, err := client.FetchVideo(no)
		switch {
		case errors.Is(err, dmm.ErrVideoNotFound):
			if vid, ok := vids[no]; ok {
				if err := idx.Delete(ctx, vid); err != nil {
					return result, fmt.Errorf("delete %s: %w", no, err)
				}
				result.Deleted++
			} else {
				result.Failed++
			}
			continue
		case err != nil || v.VodDate == "":
			result.Failed++
			continue
		}
		v.BookmarkCount, v.FetchedAt = bookmark, now.Format(time.RFC3339)
		// 依配信日判斷是否預約中（DMM 的 releaseStatus 不可靠）；重抓後發現已經配信的就不標
		if vod, err := time.ParseInLocation("2006/01/02", v.VodDate, jst); err == nil && vod.After(today) {
			v.ReleaseStatus = dmm.ReleaseStatusPreOrder
		}
		if _, err := persistVideos(ctx, repo, []dmm.DmmVideo{v}, false); err != nil {
			return result, fmt.Errorf("persist %s: %w", no, err)
		}
		result.Fetched++
		time.Sleep(upcomingDetailDelay)
	}
	return result, nil
}

// RunUpcomingSyncCron 排程入口：結果與錯誤只記 log；daysParam 空字串是 30 天（手動 -cmd 可用 -days 縮短）
func RunUpcomingSyncCron(daysParam string) {
	days, err := strconv.Atoi(daysParam)
	if err != nil {
		days = upcomingDays
	}
	startedAt := time.Now()
	r, err := SyncUpcomingVideos(context.Background(), days)
	fields := []zap.Field{
		zap.Int("listed", r.Listed), zap.Int("fetched", r.Fetched), zap.Int("kept", r.Kept),
		zap.Int("failed", r.Failed), zap.Int("deleted", r.Deleted), zap.Duration("elapsed", time.Since(startedAt)),
	}
	if err != nil {
		log.Logger().Error("upcoming video sync failed", append(fields, zap.Error(err))...)
		return
	}
	log.Logger().Info("upcoming video sync done", fields...)
}
