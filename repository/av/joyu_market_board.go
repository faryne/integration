package av

import (
	"time"

	"faryne.dev/model/entity/opendata/av"
)

// joyu 女優股市的排行榜與走勢資料。總資產 = 現金 + Σ 持股 × 現價（依市價計算）；
// 每次都是即時 GROUP BY 全部錢包，使用者多了再改成定時算好存起來（service 端另有 5 分鐘快取）

// marketTotalsSQL 每個錢包的總資產（分）
const marketTotalsSQL = `SELECT w.firebase_uid AS uid, w.cash + COALESCE(SUM(h.shares * s.last_price), 0) AS total
FROM joyu_wallets w
LEFT JOIN joyu_holdings h ON h.firebase_uid = w.firebase_uid
LEFT JOIN joyu_stocks s ON s.id = h.stock_id
GROUP BY w.firebase_uid, w.cash`

// MarketLeaderRow 排行榜一列（repository 內部用，含 uid）
type MarketLeaderRow struct {
	UID      string
	Total    int64
	Nickname string
}

// Leaderboard 總資產前 limit 名（暱稱從 joyu_users 來，刪除帳號的不顯示暱稱）
func (r *RepositoryJoyuMarket) Leaderboard(limit int) ([]MarketLeaderRow, error) {
	var rows []MarketLeaderRow
	err := r.primary().Raw(`SELECT t.uid, t.total, COALESCE(u.nickname, '') AS nickname FROM (`+marketTotalsSQL+`) t
LEFT JOIN joyu_users u ON u.firebase_uid = t.uid AND u.is_deleted = 0
ORDER BY t.total DESC, t.uid LIMIT ?`, limit).Scan(&rows).Error
	return rows, err
}

// RankOf 總資產 total（分）排第幾名：比它多的人數 + 1
func (r *RepositoryJoyuMarket) RankOf(total int64) (int64, error) {
	var n int64
	err := r.primary().Raw(`SELECT COUNT(*) FROM (`+marketTotalsSQL+`) t WHERE t.total > ?`, total).Scan(&n).Error
	return n + 1, err
}

// TopHoldings 每個人市值最大的那一檔（排行榜顯示「最大持股」）
func (r *RepositoryJoyuMarket) TopHoldings(uids []string) (map[string]av.JoyuStock, error) {
	out := map[string]av.JoyuStock{}
	if len(uids) == 0 {
		return out, nil
	}
	var rows []struct {
		UID     string
		StockID int
		Name    string
		Value   int64
	}
	err := r.primary().Raw(`SELECT h.firebase_uid AS uid, s.id AS stock_id, s.name, h.shares * s.last_price AS value
FROM joyu_holdings h JOIN joyu_stocks s ON s.id = h.stock_id
WHERE h.firebase_uid IN ? ORDER BY value DESC`, uids).Scan(&rows).Error
	for _, row := range rows {
		if _, ok := out[row.UID]; !ok {
			out[row.UID] = av.JoyuStock{ID: row.StockID, Name: row.Name}
		}
	}
	return out, err
}

// DailyHistory 一檔從 from 起的每日紀錄（走勢圖），舊的在前
func (r *RepositoryJoyuMarket) DailyHistory(stockID int, from time.Time) ([]av.JoyuStockDaily, error) {
	var rows []av.JoyuStockDaily
	err := r.db.Where("stock_id = ? AND date >= ?", stockID, from.Format(time.DateOnly)).Order("date").Find(&rows).Error
	return rows, err
}
