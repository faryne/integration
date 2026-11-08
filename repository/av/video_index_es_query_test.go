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
