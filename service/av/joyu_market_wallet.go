package av

import (
	"time"

	avEntity "faryne.dev/model/entity/opendata/av"
	avRepo "faryne.dev/repository/av"
	"faryne.dev/service/log"
)

// joyu 女優股市：我的資產、成交紀錄、每日收盤

const marketTradesPageSize = 30

// MarketWalletFor 我的資產（第一次進股市時開戶）：現金、各檔持股（照現價算市值）、總資產與報酬率
func MarketWalletFor(uid string) (*avEntity.MarketWallet, error) {
	w, err := openMarketWallet(uid)
	if err != nil {
		return nil, err
	}
	holdings, err := avRepo.NewJoyuMarket().Holdings(uid)
	if err != nil {
		return nil, err
	}
	stocks, err := marketStocksByIDs(holdingStockIDs(holdings))
	if err != nil {
		return nil, err
	}
	today := marketToday()
	out := &avEntity.MarketWallet{Cash: centsToUnits(w.Cash), Holdings: make([]avEntity.MarketHolding, 0, len(holdings))}
	for _, h := range holdings {
		s, ok := stocks[h.StockID]
		if !ok {
			continue
		}
		out.Holdings = append(out.Holdings, avEntity.MarketHolding{Stock: s, Shares: h.Shares, Sellable: h.Sellable(today), Cost: centsToUnits(h.Cost)})
		out.HoldingsValue += s.Price * float64(h.Shares)
	}
	out.Total = out.Cash + out.HoldingsValue
	out.ReturnPct = (out.Total/centsToUnits(marketInitialCash) - 1) * 100
	return out, nil
}

// MarketTradesFor 我的成交紀錄（新的在前，一頁 30 筆）
func MarketTradesFor(uid string, page int) ([]avEntity.MarketTradeRow, int64, error) {
	page = max(page, 1)
	rows, total, err := avRepo.NewJoyuMarket().TradesByUID(uid, page, marketTradesPageSize)
	if err != nil {
		return nil, 0, err
	}
	ids := make([]int, len(rows))
	for i, t := range rows {
		ids[i] = t.StockID
	}
	stocks, err := avRepo.NewJoyuStock().FindByIDs(ids)
	if err != nil {
		return nil, 0, err
	}
	names := make(map[int]string, len(stocks))
	for _, s := range stocks {
		names[s.ID] = s.Name
	}
	out := make([]avEntity.MarketTradeRow, len(rows))
	for i, t := range rows {
		out[i] = avEntity.MarketTradeRow{Code: avEntity.StockCode(t.StockID), Name: names[t.StockID], Side: t.Side, Shares: t.Shares,
			Amount: centsToUnits(t.Amount), Fee: centsToUnits(t.Fee), CreatedAt: t.CreatedAt}
	}
	return out, total, nil
}

// marketStocksByIDs 持股那幾檔的現價與照片（含已下市的）
func marketStocksByIDs(ids []int) (map[int]avEntity.MarketStock, error) {
	rows, err := avRepo.NewJoyuStock().FindByIDs(ids)
	if err != nil {
		return nil, err
	}
	list, err := marketStocksWithPhotos(rows)
	if err != nil {
		return nil, err
	}
	out := make(map[int]avEntity.MarketStock, len(list))
	for i, s := range list {
		out[rows[i].ID] = s
	}
	return out, nil
}

func holdingStockIDs(holdings []avEntity.JoyuHolding) []int {
	ids := make([]int, len(holdings))
	for i, h := range holdings {
		ids[i] = h.StockID
	}
	return ids
}

// RunMarketCloseCron 每天 00:00 收盤：剛結束那天的價格紀錄補齊、收盤價寫進昨收（漲跌幅與漲跌停的基準）。
// 用一小時前的日期當「剛結束那天」：00:00 跑就是前一天。白天手動跑會把當下的價格當成昨收，只在漏跑時補救用
func RunMarketCloseCron() {
	date := time.Now().Add(-time.Hour).Format(time.DateOnly)
	if err := avRepo.NewJoyuMarket().CloseDay(date); err != nil {
		log.Logger().Error("market close failed: " + err.Error())
		return
	}
	log.Logger().Info("market closed: " + date)
}

// deleteMarketData 刪帳號時清掉股市資料：持股從流通股數扣掉、價格照曲線重算，再刪持股、成交、錢包
func deleteMarketData(uid string) error {
	return avRepo.NewJoyuMarket().DeleteByUID(uid, func(s avEntity.JoyuStock, sharesOut int64) int64 {
		return marketPrice(s.Fundamental, sharesOut)
	})
}
