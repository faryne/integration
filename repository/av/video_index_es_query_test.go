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

// 配信狀態：預設只看已配信的（must_not 未來，沒有配信日的舊資料不受影響）；Upcoming 只看明天以後；依番號查單部兩者都查得到
func TestApplyVideoConditionsReleaseState(t *testing.T) {
	body := func(in av.VideoIndexQuery) string {
		q := map[string]any{}
		applyVideoConditions(in, q)
		b, _ := json.Marshal(q)
		return string(b)
	}
	future := `"vod_date":{"gte":"` + jstTomorrow() + `"}`
	if s := body(av.VideoIndexQuery{}); !strings.Contains(s, `"must_not":{"range":{`+future) {
		t.Fatalf("default should exclude future videos: %s", s)
	}
	if s := body(av.VideoIndexQuery{Upcoming: true}); !strings.Contains(s, `{"range":{`+future+`}}`) || strings.Contains(s, "must_not") {
		t.Fatalf("upcoming should only include future videos: %s", s)
	}
	if s := body(av.VideoIndexQuery{VideoQueryRequest: av.VideoQueryRequest{No: "SDAM-186"}}); strings.Contains(s, future) {
		t.Fatalf("lookup by number should not filter release state: %s", s)
	}
	// 影片搜尋的 release 參數：upcoming 跟 Upcoming 一樣、all 不限
	if s := body(av.VideoIndexQuery{VideoQueryRequest: av.VideoQueryRequest{Release: av.VideoReleaseUpcoming}}); !strings.Contains(s, `{"range":{`+future+`}}`) || strings.Contains(s, "must_not") {
		t.Fatalf("release=upcoming should only include future videos: %s", s)
	}
	if s := body(av.VideoIndexQuery{VideoQueryRequest: av.VideoQueryRequest{Release: av.VideoReleaseAll}}); strings.Contains(s, future) {
		t.Fatalf("release=all should not filter release state: %s", s)
	}
}
