package twse

import (
	"math"
	"testing"
)

func TestDeriveSplitRatio(t *testing.T) {
	cases := []struct {
		name       string
		closePrice float64
		refPrice   float64
		want       float64
		wantOK     bool
	}{
		{"0050 一拆四", 188.65, 47.16, 4, true},
		{"00631L 一拆二十二", 443.15, 20.14, 22, true},
		{"一拆十一", 100.05, 9.10, 11, true},
		{"00632R 七合一", 3.28, 22.96, 1.0 / 7, true},
		{"00673R 四合一", 7.02, 28.08, 0.25, true},
		{"非整數倍跳過", 100, 40, 0, false},
		{"價格相同", 10, 10, 0, false},
		{"缺價格", 0, 10, 0, false},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			got, ok := deriveSplitRatio(c.closePrice, c.refPrice)
			if ok != c.wantOK || math.Abs(got-c.want) > 1e-9 {
				t.Fatalf("deriveSplitRatio(%v, %v) = %v, %v; want %v, %v", c.closePrice, c.refPrice, got, ok, c.want, c.wantOK)
			}
		})
	}
}
