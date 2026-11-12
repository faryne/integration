package av

import "math"

// joyu 女優股市的價格曲線（系統造市）：P = F × (1 + S / L)。
// F 基本面（單位）、S 使用者持有的總股數、L 深度。金額一律是「分」：
// 買的成本無條件進位、賣的所得無條件捨去、手續費無條件進位，系統只會收錢、不會多發錢
const (
	marketDepth       = 20000                // L：S 每多 L 股，價格多一倍 F
	marketFeeRate     = 0.01                 // 手續費 1%，直接銷毀
	marketPriceLimit  = 0.2                  // 單日漲跌幅 ±20%（以昨收為準）
	marketInitialCash = int64(100000 * 100)  // 開戶入帳 100000 單位
	marketMaxShares   = int64(1_000_000_000) // 單筆股數上限，防止算式溢位
)

// marketPrice 現價（分，四捨五入）
func marketPrice(f float64, s int64) int64 {
	return int64(math.Round(f * 100 * (1 + float64(s)/marketDepth)))
}

// curveArea 曲線在 S～S+q 之間的面積（分）：買 q 股的理論成本
func curveArea(f float64, s, q int64) float64 {
	return f * 100 * float64(q) * (1 + float64(2*s+q)/(2*marketDepth))
}

// buyAmount 買 q 股的成交金額（分，進位）
func buyAmount(f float64, s, q int64) int64 {
	return int64(math.Ceil(curveArea(f, s, q)))
}

// sellAmount 賣 q 股的成交金額（分，捨去）：沿同一條曲線往回走
func sellAmount(f float64, s, q int64) int64 {
	return int64(math.Floor(curveArea(f, s-q, q)))
}

// marketFee 手續費（分，進位）
func marketFee(amount int64) int64 {
	return int64(math.Ceil(float64(amount) * marketFeeRate))
}

// marketLimits 漲跌停價（分）
func marketLimits(prevClose int64) (lo, hi int64) {
	return int64(math.Round(float64(prevClose) * (1 - marketPriceLimit))), int64(math.Round(float64(prevClose) * (1 + marketPriceLimit)))
}

// maxBuyByLimit 買完股價不超過漲停的最大股數（已經漲停就是 0）。
// 先用反函數估，再前後各修正幾股：浮點誤差和價格四捨五入會讓估出來的值差 1～2 股
func maxBuyByLimit(f float64, s, hi int64) int64 {
	q := min(max(int64(math.Floor(marketDepth*(float64(hi)/(f*100)-1)))-s, 0), marketMaxShares)
	for q < marketMaxShares && marketPrice(f, s+q+1) <= hi {
		q++
	}
	for q > 0 && marketPrice(f, s+q) > hi {
		q--
	}
	return q
}

// maxSellByLimit 賣完股價不低於跌停的最大股數（最多就是全部流通股數），修正方式同 maxBuyByLimit
func maxSellByLimit(f float64, s, lo int64) int64 {
	q := min(max(s-int64(math.Ceil(marketDepth*(float64(lo)/(f*100)-1))), 0), s)
	for q < s && marketPrice(f, s-q-1) >= lo {
		q++
	}
	for q > 0 && marketPrice(f, s-q) < lo {
		q--
	}
	return q
}

// maxBuyByCash 現金買得起的最大股數（含手續費）；成本隨股數遞增，用二分搜尋
func maxBuyByCash(f float64, s, cash, upper int64) int64 {
	lo, hi := int64(0), upper
	for lo < hi {
		mid := (lo + hi + 1) / 2
		if a := buyAmount(f, s, mid); a+marketFee(a) <= cash {
			lo = mid
		} else {
			hi = mid - 1
		}
	}
	return lo
}
