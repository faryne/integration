package av

import (
	"net/url"
	"testing"

	avEntity "faryne.dev/model/entity/opendata/av"
)

// 追蹤內容的正規化：同一個對象不論怎麼送來都存成同一個 value，不收的內容回 ErrFollowInvalid
func TestNormalizeFollow(t *testing.T) {
	ok := []struct{ kind, in, want string }{
		{avEntity.FollowKindActress, " xcity:22221 ", "xcity:22221"},
		{avEntity.FollowKindActress, "manual:5", "manual:5"},
		{avEntity.FollowKindTag, " 痴女 ", "痴女"},
		// 參數順序、重複標籤、不收的參數（page、日期）都不影響結果
		{avEntity.FollowKindSearch, "?tag=痴女&label=MOODYZ DIVA&tag=巨乳&tag=痴女&actress=星宮みお&xcity_id=12&keyword= x &page=2&start_date=2026-01-01",
			url.Values{"keyword": {"x"}, "actress": {"星宮みお"}, "xcity_id": {"12"}, "label": {"MOODYZ DIVA"}, "tag": {"巨乳", "痴女"}}.Encode()},
		// 多值：每個參數的值去重排序；兩位以上出演時不存女優 ID
		{avEntity.FollowKindSearch, "actress=B&actress=A&xcity_id=12&maker=S1&maker=MOODYZ&maker=S1",
			url.Values{"actress": {"A", "B"}, "maker": {"MOODYZ", "S1"}}.Encode()},
		// 只有關鍵字也可以追蹤
		{avEntity.FollowKindSearch, "keyword=cosplay", "keyword=cosplay"},
	}
	for _, c := range ok {
		got, err := normalizeFollow(c.kind, c.in)
		if err != nil || got != c.want {
			t.Fatalf("%s %q: got %q, %v; want %q", c.kind, c.in, got, err, c.want)
		}
	}
	bad := []struct{ kind, in string }{
		{avEntity.FollowKindActress, "dmm:1"},   // 只收 xcity／手動上稿
		{avEntity.FollowKindActress, "xcity:0"}, // aid 要是正整數
		{avEntity.FollowKindMaker, "  "},
		{avEntity.FollowKindSearch, "start_date=2026-01-01"}, // 只有日期不算條件
		{avEntity.FollowKindSearch, "xcity_id=12"},           // 只有 ID 沒有名字
		{"unknown", "x"},
	}
	for _, c := range bad {
		if _, err := normalizeFollow(c.kind, c.in); err != ErrFollowInvalid {
			t.Fatalf("%s %q: want ErrFollowInvalid, got %v", c.kind, c.in, err)
		}
	}
}

// 搜尋條件的顯示名稱：關鍵字（加引號）、女優、發售商…依序，最後是標籤；聯集的欄位用／連起來
func TestSearchFollowLabel(t *testing.T) {
	p := url.Values{"tag": {"痴女"}, "maker": {"MOODYZ", "S1"}, "actress": {"星宮みお", "美園和花"}, "keyword": {"cosplay"}}
	if got := searchFollowLabel(p); got != "「cosplay」 × 星宮みお × 美園和花 × MOODYZ／S1 × 痴女" {
		t.Fatalf("got %q", got)
	}
}
