package av

import (
	"encoding/json"
	"strings"
	"testing"

	avEntity "faryne.dev/model/entity/opendata/av"
)

// 只給月份（＋日）時：篩當月、那天以後，依生日日期排；joyu 首頁「近期生日」用
func TestBuildActressSearchQueryBirthMonthOnly(t *testing.T) {
	body, _ := json.Marshal(buildActressSearchQuery(avEntity.ActressQueryRequest{BirthMonth: 11, BirthDay: 8}, nil))
	s := string(body)
	for _, want := range []string{`{"term":{"birth_month":11}}`, `{"range":{"birth_day":{"gte":8}}}`, `"sort":[{"birth_day":{"order":"asc"}}`} {
		if !strings.Contains(s, want) {
			t.Fatalf("query missing %s: %s", want, s)
		}
	}
	// 有年份時維持原本的年月條件，不套用「某日以後」
	body, _ = json.Marshal(buildActressSearchQuery(avEntity.ActressQueryRequest{BirthYear: 1999, BirthMonth: 11}, nil))
	if strings.Contains(string(body), `"range":{"birth_day"`) {
		t.Fatalf("year+month query should not filter birth_day: %s", body)
	}
}
