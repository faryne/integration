package av

import (
	"testing"
	"time"
)

func TestMarketEligible(t *testing.T) {
	cases := []struct {
		years []int
		want  bool
	}{
		{[]int{10, 10, 10}, true},
		// 某一年不夠就不行，即使合計很多
		{[]int{40, 40, 3}, false},
		// 每年都夠但合計不夠
		{[]int{5, 5, 5}, false},
		{[]int{4, 4, 22}, true},
	}
	for _, c := range cases {
		if got := marketEligible(c.years, 4, 30); got != c.want {
			t.Errorf("marketEligible(%v) = %v, want %v", c.years, got, c.want)
		}
	}
}

// 滾動年度要首尾相接、不重疊，第 0 段包含今天
func TestMarketWindows(t *testing.T) {
	w := marketWindows(time.Date(2026, 11, 12, 15, 0, 0, 0, time.Local))
	if got := w[0][1].Format("2006/01/02"); got != "2026/11/13" {
		t.Errorf("window 0 end = %s", got)
	}
	if got := w[0][0].Format("2006/01/02"); got != "2025/11/13" {
		t.Errorf("window 0 start = %s", got)
	}
	for i := 1; i < len(w); i++ {
		if !w[i][1].Equal(w[i-1][0]) {
			t.Errorf("window %d end %v != window %d start %v", i, w[i][1], i-1, w[i-1][0])
		}
	}
}
