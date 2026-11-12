package av

import (
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"time"

	avEntity "faryne.dev/model/entity/opendata/av"
	"faryne.dev/model/enum"
	avRepo "faryne.dev/repository/av"
	"faryne.dev/service/client"
)

// joyu 女優股市的排行榜與走勢圖

const (
	marketLeaderboardSize     = 50
	marketLeaderboardCacheKey = "joyu:market:leaderboard"
	marketLeaderboardCacheTTL = 5 * time.Minute
	marketHistoryMaxDays      = 365
)

// marketLeaderName 排行榜顯示的名字：有暱稱用暱稱，沒有就用 uid 雜湊出來的匿名代號（不洩漏 uid、同一人每次都一樣）
func marketLeaderName(nickname, uid string) string {
	if nickname != "" {
		return nickname
	}
	sum := sha1.Sum([]byte(uid))
	return "投資人 " + hex.EncodeToString(sum[:2])
}

// MarketLeaderboard 總資產前 50 名，快取 5 分鐘（Redis 沒設定時每次現算）
func MarketLeaderboard() ([]avEntity.MarketLeader, error) {
	r := client.GetRedis(enum.RedisDefault)
	if r != nil {
		var cached []avEntity.MarketLeader
		if raw, err := r.Get(marketLeaderboardCacheKey).Bytes(); err == nil && json.Unmarshal(raw, &cached) == nil {
			return cached, nil
		}
	}
	repo := avRepo.NewJoyuMarket()
	rows, err := repo.Leaderboard(marketLeaderboardSize)
	if err != nil {
		return nil, err
	}
	uids := make([]string, len(rows))
	for i, row := range rows {
		uids[i] = row.UID
	}
	tops, err := repo.TopHoldings(uids)
	if err != nil {
		return nil, err
	}
	out := make([]avEntity.MarketLeader, len(rows))
	for i, row := range rows {
		total := centsToUnits(row.Total)
		out[i] = avEntity.MarketLeader{Rank: i + 1, Name: marketLeaderName(row.Nickname, row.UID), Total: total,
			ReturnPct: (total/centsToUnits(marketInitialCash) - 1) * 100}
		if s, ok := tops[row.UID]; ok {
			out[i].TopCode, out[i].TopName = avEntity.StockCode(s.ID), s.Name
		}
	}
	if r != nil {
		if raw, err := json.Marshal(out); err == nil {
			r.Set(marketLeaderboardCacheKey, raw, marketLeaderboardCacheTTL)
		}
	}
	return out, nil
}

// MarketHistory 走勢圖：最近 days 天（1～365）的每日收盤；今天還沒收盤，前端自己把現價接在最後
func MarketHistory(code string, days int) ([]avEntity.MarketPricePoint, error) {
	s, err := avRepo.NewJoyuStock().FindByID(avEntity.StockIDFromCode(code))
	if err != nil {
		return nil, err
	}
	days = min(max(days, 1), marketHistoryMaxDays)
	rows, err := avRepo.NewJoyuMarket().DailyHistory(s.ID, time.Now().AddDate(0, 0, -days))
	if err != nil {
		return nil, err
	}
	out := make([]avEntity.MarketPricePoint, len(rows))
	for i, d := range rows {
		out[i] = avEntity.MarketPricePoint{Date: d.Date.Format(time.DateOnly), Close: centsToUnits(d.Close), Volume: d.Volume}
	}
	return out, nil
}
