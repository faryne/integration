package av

import (
	"slices"

	avRepo "faryne.dev/repository/av"
)

// parseActressKey 解析「{domain}-{aid}」；格式不對回傳 false
func parseActressKey(key string) (string, int, bool) {
	m := actressKeyPattern.FindStringSubmatch(key)
	if m == nil {
		return "", 0, false
	}
	return m[1], atoi(m[2]), true
}

// actressVideoQuery 女優頁出演影片的條件。同名女優靠 DMM 女優 ID 分開，但 2026-10-30 之前的影片沒有 actress_ids，只能照名字：
//   - 這位有 DMM ID：ID 相符的影片，加上名字相符但沒有 actress_ids 的舊影片
//   - 這位沒有 DMM ID：名字相符，但排除同名其他女優登記過的 ID
//
// key 對不到女優時回傳 nil，呼叫端照原本的 actress（名字）條件查
func actressVideoQuery(key string) (map[string]any, error) {
	domain, aid, ok := parseActressKey(key)
	if !ok {
		return nil, nil
	}
	repo := avRepo.NewDMMActress()
	row, err := repo.FindByKey(nil, domain, aid)
	if err != nil {
		return nil, nil
	}
	name, dmmID := row.Name, actressRowFields(*row).DMMID
	byName := map[string]any{"term": map[string]any{"actresses.keyword": name}}
	if dmmID != "" {
		legacy := map[string]any{"bool": map[string]any{
			"must":     byName,
			"must_not": map[string]any{"exists": map[string]any{"field": "actress_ids"}},
		}}
		return map[string]any{"bool": map[string]any{
			"should":               []map[string]any{{"term": map[string]any{"actress_ids": dmmID}}, legacy},
			"minimum_should_match": 1,
		}}, nil
	}

	siblings, err := repo.FindByNames(actressSearchDomains, []string{name})
	if err != nil {
		return nil, err
	}
	// MySQL collation 不分平假名／片假名（アイラ＝あいら），這裡再比一次完全相同的名字
	var claimed []string
	for _, s := range siblings {
		if id := actressRowFields(s).DMMID; s.Name == name && id != "" && !slices.Contains(claimed, id) {
			claimed = append(claimed, id)
		}
	}
	if len(claimed) == 0 {
		return byName, nil
	}
	return map[string]any{"bool": map[string]any{
		"must":     byName,
		"must_not": map[string]any{"terms": map[string]any{"actress_ids": claimed}},
	}}, nil
}
