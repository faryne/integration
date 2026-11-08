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
		// 參數順序、重複標籤、不收的參數（keyword、page）都不影響結果
		{avEntity.FollowKindSearch, "?tag=痴女&label=MOODYZ DIVA&tag=巨乳&tag=痴女&actress=星宮みお&xcity_id=12&keyword=x&page=2",
			url.Values{"actress": {"星宮みお"}, "xcity_id": {"12"}, "label": {"MOODYZ DIVA"}, "tag": {"巨乳", "痴女"}}.Encode()},
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
		{avEntity.FollowKindSearch, "keyword=abc"}, // 只有模糊關鍵字不算條件
		{avEntity.FollowKindSearch, "xcity_id=12"}, // 只有 ID 沒有名字
		{"unknown", "x"},
	}
	for _, c := range bad {
		if _, err := normalizeFollow(c.kind, c.in); err != ErrFollowInvalid {
			t.Fatalf("%s %q: want ErrFollowInvalid, got %v", c.kind, c.in, err)
		}
	}
}

// 搜尋條件的顯示名稱：女優、發售商…依序，最後是標籤
func TestSearchFollowLabel(t *testing.T) {
	p := url.Values{"tag": {"痴女"}, "label": {"MOODYZ DIVA"}, "actress": {"星宮みお"}}
	if got := searchFollowLabel(p); got != "星宮みお × MOODYZ DIVA × 痴女" {
		t.Fatalf("got %q", got)
	}
}
