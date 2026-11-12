package av

import (
	"math"
	"testing"
)

func TestMarketTargetFundamental(t *testing.T) {
	cases := []struct {
		recent int
		median float64
		want   float64
	}{
		{20, 20, 10}, // 剛好中位數
		{80, 20, 20}, // 4 倍片量 → 2 倍
		{5, 20, 5},   // 1/4 → 一半
		{0, 20, 1},   // 沒出片 → 下限 1
		{10000, 1, 100},
		{3, 0, marketFundamentalBase * math.Sqrt(3)}, // 中位數 0 當 1
	}
	for _, c := range cases {
		if got := marketTargetFundamental(c.recent, c.median); math.Abs(got-c.want) > 1e-9 {
			t.Errorf("target(%d, %v) = %v, want %v", c.recent, c.median, got, c.want)
		}
	}
}

// 一天最多離開盤 F ±2.5%；目標在範圍內就照目標
func TestFundamentalDailyStep(t *testing.T) {
	if f := fundamentalWithinLimit(50, 0, 1000, 10); f != 10.25 {
		t.Errorf("up = %v", f)
	}
	if f := fundamentalWithinLimit(1, 0, 1000, 10); f != 9.75 {
		t.Errorf("down = %v", f)
	}
	if f := fundamentalWithinLimit(10.1, 0, 1000, 10); f != 10.1 {
		t.Errorf("within = %v", f)
	}
}

// 單日上限之外，調完的股價也不能超過漲跌停（例如玩家已經把股價推到接近漲停）
func TestFundamentalWithinLimit(t *testing.T) {
	for _, s := range []int64{0, 1234, 40000} {
		lo, hi := marketLimits(1000)
		// 開盤 F 設得很極端，讓單日上限不是瓶頸，只剩漲跌停在限制
		if f := fundamentalWithinLimit(1000, s, 1000, 1000); marketPrice(f, s) > hi || marketPrice(f, s) < hi-1 {
			t.Errorf("s=%d up: f=%v price=%d hi=%d", s, f, marketPrice(f, s), hi)
		}
		if f := fundamentalWithinLimit(0.001, s, 1000, 0.001); marketPrice(f, s) < lo || marketPrice(f, s) > lo+1 {
			t.Errorf("s=%d down: f=%v price=%d lo=%d", s, f, marketPrice(f, s), lo)
		}
	}
}

func TestMarketMedian(t *testing.T) {
	if m := marketMedian([]int{5, 1, 3}); m != 3 {
		t.Errorf("odd = %v", m)
	}
	if m := marketMedian([]int{4, 1, 3, 10}); m != 3.5 {
		t.Errorf("even = %v", m)
	}
}
