package av

import "testing"

// 買完立刻賣回：成交金額最多差 1 分（進位／捨去），扣掉兩次手續費一定虧，沒有套利空間
func TestMarketRoundTrip(t *testing.T) {
	for _, c := range []struct {
		f    float64
		s, q int64
	}{{10, 0, 100}, {10, 5000, 1}, {37.1234, 123456, 9999}, {1, 0, 1}} {
		buy := buyAmount(c.f, c.s, c.q)
		sell := sellAmount(c.f, c.s+c.q, c.q)
		if buy-sell < 0 || buy-sell > 1 {
			t.Errorf("f=%v s=%d q=%d: buy %d sell %d", c.f, c.s, c.q, buy, sell)
		}
		if spent, got := buy+marketFee(buy), sell-marketFee(sell); got >= spent {
			t.Errorf("round trip should lose money: spent %d got %d", spent, got)
		}
	}
}

// 分好幾筆買跟一次買完的總成本只差進位（每筆最多 1 分），拆單占不到便宜
func TestMarketSplitBuy(t *testing.T) {
	f, s := 12.5, int64(3000)
	whole := buyAmount(f, s, 1000)
	var parts int64
	for i := int64(0); i < 10; i++ {
		parts += buyAmount(f, s+i*100, 100)
	}
	if parts < whole || parts-whole > 10 {
		t.Errorf("parts %d whole %d", parts, whole)
	}
}

func TestMarketLimits(t *testing.T) {
	lo, hi := marketLimits(1000)
	if lo != 800 || hi != 1200 {
		t.Fatalf("limits = %d, %d", lo, hi)
	}
	// IPO（F=10、S=0）：漲到 12 大約要 L×0.2＝4000 股；價格四捨五入到分，多買幾股仍是 12.00，再多 1 股就超過
	if q := maxBuyByLimit(10, 0, hi); q < 4000 || marketPrice(10, q) > 1200 || marketPrice(10, q+1) <= 1200 {
		t.Errorf("maxBuyByLimit = %d", q)
	}
	// 已經超過漲停就不能再買
	if q := maxBuyByLimit(10, 4100, hi); q != 0 {
		t.Errorf("at limit maxBuy = %d", q)
	}
	// S=0 時沒有股票可賣；S=5000（價格 12.5）跌停 8 但最多只能賣光
	if q := maxSellByLimit(10, 0, lo); q != 0 {
		t.Errorf("maxSell empty = %d", q)
	}
	if q := maxSellByLimit(10, 5000, lo); q != 5000 {
		t.Errorf("maxSell all = %d", q)
	}
	// 基本面 F=8 時價格靠 S 撐著：賣到價格剛好 8 為止
	if q := maxSellByLimit(8, 5000, 900); marketPrice(8, 5000-q) < 900 || marketPrice(8, 5000-q-1) >= 900 {
		t.Errorf("maxSell by limit = %d", q)
	}
}

func TestMaxBuyByCash(t *testing.T) {
	cash := marketInitialCash
	q := maxBuyByCash(10, 0, cash, 1_000_000)
	a := buyAmount(10, 0, q)
	if a+marketFee(a) > cash {
		t.Fatalf("q=%d over budget", q)
	}
	if a2 := buyAmount(10, 0, q+1); a2+marketFee(a2) <= cash {
		t.Errorf("q=%d not max", q)
	}
}
