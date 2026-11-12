package av

import (
	"context"
	"fmt"
	"math"
	"sort"
	"time"

	avEntity "faryne.dev/model/entity/opendata/av"
	avRepo "faryne.dev/repository/av"
	"faryne.dev/service/log"
	"go.uber.org/zap"

	"gorm.io/gorm"
)

// joyu 女優股市的基本面 F（規格「基本面 F（2026-11-12 定案）」）：
// 目標 F* = 10 × √(她近 90 天部數 ÷ 全部上市股近 90 天部數的中位數)，夾在 1～100；
// 實際 F 每次往 F* 調，但一天最多只能離「開盤時的 F」±2.5%，調完的股價也不能超過漲跌停。
// 漲跌停（±20%）的空間是留給玩家交易的，基本面只是慢慢推（目標兩倍約 4 週到位）；
// 而且一天 2.5% 只比來回買賣的手續費（約 2%）多一點，看到新片搶先買也賺不到什麼。
// 上市當天不動（大家都從 10 開始）。每次影片同步完、每天收盤後都整批重算（算的是絕對值，重跑不會重複加）
const (
	marketFundamentalBase = 10.0
	marketFundamentalMin  = 1.0
	marketFundamentalMax  = 100.0
	// marketFundamentalDailyStep 基本面一天最多變動的比例（以開盤時的 F 為準）
	marketFundamentalDailyStep = 0.025
)

// marketTargetFundamental F*：出片量剛好是中位數時是 10；開根號壓低量產型的優勢（4 倍片量 → 2 倍）
func marketTargetFundamental(recent int, median float64) float64 {
	median = max(median, 1)
	return min(max(marketFundamentalBase*math.Sqrt(float64(recent)/median), marketFundamentalMin), marketFundamentalMax)
}

// fundamentalWithinLimit 把 F 夾在「離開盤 F 不超過 ±2.5%」且「調完股價還在漲跌停內」的範圍，
// 存成小數 4 位（資料表 DECIMAL(12,4)），四捨五入後若剛好超出漲跌停一分，再往內收一格
func fundamentalWithinLimit(target float64, s, prevClose int64, openF float64) float64 {
	lo, hi := marketLimits(prevClose)
	k := 100 * (1 + float64(s)/marketDepth)
	target = min(max(target, openF*(1-marketFundamentalDailyStep)), openF*(1+marketFundamentalDailyStep))
	f := math.Round(min(max(target, float64(lo)/k), float64(hi)/k)*10000) / 10000
	switch {
	case marketPrice(f, s) > hi:
		f -= 0.0001
	case marketPrice(f, s) < lo:
		f += 0.0001
	}
	return f
}

// marketMedian 近 90 天部數的中位數
func marketMedian(counts []int) float64 {
	if len(counts) == 0 {
		return 0
	}
	sorted := append([]int(nil), counts...)
	sort.Ints(sorted)
	n := len(sorted)
	if n%2 == 1 {
		return float64(sorted[n/2])
	}
	return float64(sorted[n/2-1]+sorted[n/2]) / 2
}

// RefreshMarketFundamentals 整批重算上市股的近 90 天部數與基本面，股價跟著動（受漲跌停限制）。
// 影片同步完與收盤後呼叫；ES 寫入要約 1 秒才看得到，剛同步完的最後幾部若沒算到，下一次同步或收盤會補上
func RefreshMarketFundamentals(ctx context.Context) {
	changed, err := refreshMarketFundamentals(ctx, time.Now())
	if err != nil {
		log.Logger().Error("market fundamentals refresh failed: " + err.Error())
		return
	}
	log.Logger().Info("market fundamentals refreshed", zap.Int("changed", changed))
}

func refreshMarketFundamentals(ctx context.Context, now time.Time) (int, error) {
	stocks, err := avRepo.NewJoyuStock().ListListedPrimary()
	if err != nil || len(stocks) == 0 {
		return 0, err
	}
	recent, err := marketRecentCounts(ctx, stocks, now)
	if err != nil {
		return 0, err
	}
	counts := make([]int, len(stocks))
	for i, s := range stocks {
		counts[i] = recent[s.ID]
	}
	median := marketMedian(counts)

	repo := avRepo.NewJoyuMarket()
	today := now.Format(time.DateOnly)
	changed := 0
	for _, s := range stocks {
		// 上市當天不動基本面，大家都從 10 開始；近 90 天部數照樣更新
		listedToday := s.ListedAt.Format(time.DateOnly) == today
		target := marketTargetFundamental(recent[s.ID], median)
		err := repo.Transaction(func(tx *gorm.DB) error {
			// 鎖住後重讀：重算期間可能有人成交，S 與現價要用最新的
			cur, err := repo.LockStock(tx, s.ID)
			if err != nil {
				return err
			}
			f := cur.Fundamental
			if !listedToday {
				f = fundamentalWithinLimit(target, cur.SharesOut, cur.PrevClose, cur.OpenFundamental)
			}
			if f == cur.Fundamental && recent[s.ID] == cur.Videos90d {
				return nil
			}
			price := marketPrice(f, cur.SharesOut)
			if err := repo.SetFundamental(tx, cur.ID, f, price, recent[s.ID]); err != nil {
				return err
			}
			changed++
			if price == cur.LastPrice {
				return nil
			}
			return repo.AddDaily(tx, cur.ID, today, cur.LastPrice, price, 0)
		})
		if err != nil {
			return changed, fmt.Errorf("stock %d: %w", s.ID, err)
		}
	}
	return changed, nil
}

// marketRecentCounts 上市股各自的近 90 天部數（不含總集編）：一次分組統計，同名女優照女優頁規則逐位查。
// 名字用 dmm_actresses 目前的名字（改名後也對得到），不用上市時的快照
func marketRecentCounts(ctx context.Context, stocks []avEntity.JoyuStock, now time.Time) (map[int]int, error) {
	keys := make([]avRepo.ActressKey, len(stocks))
	for i, s := range stocks {
		keys[i] = avRepo.ActressKey{Domain: s.Domain, ID: s.AID}
	}
	rows, err := avRepo.NewDMMActress().FindByKeys(keys)
	if err != nil {
		return nil, err
	}
	names := make([]string, len(rows))
	byKey := make(map[avRepo.ActressKey]avEntity.DMMActress, len(rows))
	for i, r := range rows {
		names[i] = r.Name
		byKey[avRepo.ActressKey{Domain: r.Domain, ID: r.ID}] = r
	}
	siblings, err := avRepo.NewDMMActress().FindByNames(actressSearchDomains, names)
	if err != nil {
		return nil, err
	}
	nameCount := map[string]int{}
	for _, r := range siblings {
		nameCount[r.Name]++
	}

	window := marketWindows(now)[marketListYears]
	f := avEntity.VideoStatsFilter{From: window[0].Format(topicDateLayout), To: window[1].Format(topicDateLayout), ExcludeTag: topicCompilationTag}
	byName, err := statsByActressBaseName(ctx, f, false)
	if err != nil {
		return nil, err
	}
	out := make(map[int]int, len(stocks))
	for i, s := range stocks {
		row, ok := byKey[keys[i]]
		if !ok {
			continue // 女優資料被刪掉了，下次上市審核會下市
		}
		if nameCount[row.Name] > 1 {
			n, err := marketCountsByRow(ctx, row, [][2]time.Time{window})
			if err != nil {
				return nil, err
			}
			out[s.ID] = n[0]
		} else {
			out[s.ID] = byName[row.Name].Count
		}
	}
	return out, nil
}
