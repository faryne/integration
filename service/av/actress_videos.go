package av

import (
	"slices"

	"faryne.dev/config"
	avEntity "faryne.dev/model/entity/opendata/av"
	avRepo "faryne.dev/repository/av"
	"faryne.dev/service/search"
)

// 審核頁檢查 DMM 女優 ID 時列出幾個最常一起出現的名字
const dmmActressIDNameSize = 3

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

// dmmActressIDUsage 審核頁確認 DMM 女優 ID 沒填錯：這個 ID 出現在幾部影片、最常一起出現的名字（本人通常排第一），
// 以及已經登記這個 ID 的其他女優（核准時會被擋下）
func dmmActressIDUsage(repo *avRepo.RepositoryDMMActress, dmmID string, self *avRepo.ActressKey) (*avEntity.DMMActressIDUsage, error) {
	q := map[string]any{
		"size":  0,
		"query": map[string]any{"term": map[string]any{"actress_ids": dmmID}},
		"aggs":  map[string]any{"names": termsAgg("actresses.keyword", dmmActressIDNameSize)},
	}
	r, _, err := search.Search[avEntity.RawVideo, avEntity.CleanVideo](config.EnvConfig().DMMVideoIndex, q)
	if err != nil {
		return nil, err
	}
	usage := &avEntity.DMMActressIDUsage{DMMID: dmmID, VideoCount: int(r.Hits.Total.Value), Names: []avEntity.VideoFacetBucket{}, UsedBy: []avEntity.ActressCandidate{}}
	for _, b := range r.Aggregations["names"].Buckets {
		usage.Names = append(usage.Names, avEntity.VideoFacetBucket{Value: b.Key, Count: b.DocCount})
	}
	rows, err := repo.FindByDMMID(nil, actressSearchDomains, dmmID)
	if err != nil {
		return nil, err
	}
	for _, row := range rows {
		if self == nil || row.Domain != self.Domain || row.ID != self.ID {
			usage.UsedBy = append(usage.UsedBy, avEntity.ActressCandidate{Domain: row.Domain, AID: row.ID, Fields: actressRowFields(row)})
		}
	}
	return usage, nil
}
