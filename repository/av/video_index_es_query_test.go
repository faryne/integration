package av

import (
	"encoding/json"
	"strings"
	"testing"

	"faryne.dev/model/entity/opendata/av"
)

// 只給年份時涵蓋整年：上限是隔年 1/1（lt），12/31 當天配信的影片不能被排除
func TestApplyVideoConditionsYearCoversDec31(t *testing.T) {
	q := map[string]any{}
	applyVideoConditions(av.VideoIndexQuery{VideoQueryRequest: av.VideoQueryRequest{Year: 2025}}, q)
	body, _ := json.Marshal(q)
	if !strings.Contains(string(body), `"vod_date":{"gte":"2025/01/01","lt":"2026/01/01"}`) {
		t.Fatalf("unexpected year range: %s", body)
	}
}

// 進階搜尋：發售商多選是一個 terms（聯集）、每位出演各一個條件（交集）、片長有設就排除沒有片長資料的影片
func TestApplyVideoConditionsMultiValues(t *testing.T) {
	q := map[string]any{}
	applyVideoConditions(av.VideoIndexQuery{
		VideoQueryRequest: av.VideoQueryRequest{Maker: []string{"S1", " ", "MOODYZ"}, DurationMax: 150},
		Actresses:         []av.VideoActressFilter{{Name: "A"}, {Name: "B"}},
	}, q)
	body, _ := json.Marshal(q)
	for _, want := range []string{
		`{"terms":{"makers.keyword":["S1","MOODYZ"]}}`,
		`{"range":{"duration":{"gte":1,"lte":150}}}`,
	} {
		if !strings.Contains(string(body), want) {
			t.Fatalf("missing %s in %s", want, body)
		}
	}
	if n := strings.Count(string(body), `"actresses.keyword"`); n < 2 {
		t.Fatalf("want one actress condition per name, got %d: %s", n, body)
	}
}
