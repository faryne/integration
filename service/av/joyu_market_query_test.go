package av

import (
	"testing"

	avEntity "faryne.dev/model/entity/opendata/av"
)

// 代碼與 id 互轉；格式不對一律回 0（查不到 → 404），不能讓 "J1abc" 之類的被當成 1
func TestStockCode(t *testing.T) {
	if got := avEntity.StockCode(7); got != "J0007" {
		t.Errorf("StockCode(7) = %s", got)
	}
	cases := map[string]int{"J0007": 7, "J12345": 12345, "J7": 0, "J0007x": 0, "j0007": 0, "": 0, "J-001": 0}
	for code, want := range cases {
		if got := avEntity.StockIDFromCode(code); got != want {
			t.Errorf("StockIDFromCode(%q) = %d, want %d", code, got, want)
		}
	}
	if got := centsToUnits(1234); got != 12.34 {
		t.Errorf("centsToUnits = %v", got)
	}
}
