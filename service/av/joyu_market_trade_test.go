package av

import (
	"errors"
	"testing"

	avEntity "faryne.dev/model/entity/opendata/av"
)

// 發行上限：流通股數到上限前只能買剩下的量，超過就回「已售完」（不是現金或漲跌停）
func TestMarketShareCap(t *testing.T) {
	s := avEntity.JoyuStock{Fundamental: 10, SharesOut: 99_990, ShareCap: 100_000, PrevClose: marketPrice(10, 99_990), Status: avEntity.StockListed}
	cash := int64(1 << 50)
	q := quoteFor(s, cash, avEntity.JoyuHolding{}, avEntity.TradeBuy, 20)
	if q.MaxShares != 10 {
		t.Fatalf("max = %d, want 10", q.MaxShares)
	}
	req := avEntity.MarketTradeRequest{Side: avEntity.TradeBuy, Shares: 20, Limit: 1 << 60}
	if err := checkTrade(s, cash, avEntity.JoyuHolding{}, req, q); !errors.Is(err, ErrMarketSoldOut) {
		t.Errorf("err = %v, want sold out", err)
	}
	// 剛好買到上限可以
	req.Shares = 10
	if err := checkTrade(s, cash, avEntity.JoyuHolding{}, req, quoteFor(s, cash, avEntity.JoyuHolding{}, avEntity.TradeBuy, 10)); err != nil {
		t.Errorf("buy to cap: %v", err)
	}
	// 到上限後賣出不受影響
	s.SharesOut = 100_000
	h := avEntity.JoyuHolding{Shares: 50}
	if q := quoteFor(s, cash, h, avEntity.TradeSell, 10); q.MaxShares == 0 {
		t.Errorf("sell at cap max = 0")
	}
}
