package av

import (
	"testing"
	"time"

	avEntity "faryne.dev/model/entity/opendata/av"
)

// 重抓明細的規則：7 天以上沒抓過要重抓；3 天內要配信的、還沒有封面的，超過一天沒抓就重抓；沒有抓取時間的一律重抓
func TestNeedUpcomingRefetch(t *testing.T) {
	now := time.Date(2026, 11, 9, 12, 0, 0, 0, jst)
	at := func(d time.Duration) avEntity.VideoPreOrder {
		return avEntity.VideoPreOrder{FetchedAt: now.Add(-d).Format(time.RFC3339), Thumb: "https://example.com/ps.jpg"}
	}
	far, soon := now.AddDate(0, 0, 20), now.AddDate(0, 0, 2)
	cases := []struct {
		name string
		doc  avEntity.VideoPreOrder
		vod  time.Time
		want bool
	}{
		{"遠的、2 天前抓過", at(48 * time.Hour), far, false},
		{"遠的、8 天前抓過", at(8 * 24 * time.Hour), far, true},
		{"快配信、12 小時前抓過", at(12 * time.Hour), soon, false},
		{"快配信、30 小時前抓過", at(30 * time.Hour), soon, true},
		{"沒有抓取時間", avEntity.VideoPreOrder{}, far, true},
		{"遠的、沒封面、30 小時前抓過", avEntity.VideoPreOrder{FetchedAt: now.Add(-30 * time.Hour).Format(time.RFC3339)}, far, true},
	}
	for _, c := range cases {
		if got := needUpcomingRefetch(c.doc, c.vod, now); got != c.want {
			t.Fatalf("%s: got %v", c.name, got)
		}
	}
}
