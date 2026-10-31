package av

import (
	"slices"
	"strings"

	avEntity "faryne.dev/model/entity/opendata/av"
	avRepo "faryne.dev/repository/av"
)

// resolveActress 女優頁參數指到哪一位：xcity_id → manual_id → dmm_id（查對照表）的順序，第一個對得到的就是。
// 都對不到（含查詢失敗）回傳 nil，呼叫端照名字查，跟沒帶參數一樣
func resolveActress(xcityID, manualID int, dmmID string) *avEntity.DMMActress {
	var keys []avRepo.ActressKey
	if xcityID > 0 {
		keys = append(keys, avRepo.ActressKey{Domain: actressDomainXCity, ID: xcityID})
	}
	if manualID > 0 {
		keys = append(keys, avRepo.ActressKey{Domain: avEntity.ActressDomainManual, ID: manualID})
	}
	if dmmID = strings.TrimSpace(dmmID); dmmID != "" {
		if maps, err := avRepo.NewDMMActressMap().FindByDMMID(dmmID); err == nil && len(maps) > 0 {
			keys = append(keys, avRepo.ActressKey{Domain: maps[0].Domain, ID: maps[0].AID})
		}
	}
	rows, err := avRepo.NewDMMActress().FindByKeys(keys)
	if err != nil {
		return nil
	}
	for _, k := range keys {
		for _, row := range rows {
			if row.Domain == k.Domain && row.ID == k.ID {
				return &row
			}
		}
	}
	return nil
}

// actressPageName 女優頁要列哪個名義的作品：網址上的名字是本名或她的別名就用網址的，否則用本名
func actressPageName(row avEntity.DMMActress, name string) string {
	if name = strings.TrimSpace(name); name != "" && slices.Contains(actressRowFields(row).Aliases, name) {
		return name
	}
	return row.Name
}

// actressVideoQuery 女優頁出演影片的條件，只列 name 這個名義（本名或其中一個別名）的作品，
// 「name（別名…）」的寫法也算（見 actressNameVideoQuery）。
// 同名女優靠對照表裡的 DMM 女優 ID 分開，但 2026-10-30 之前的影片沒有 actress_ids，只能照名字：
//   - 這位在對照表有 DMM ID：名字相符，而且 ID 相符或是沒有 actress_ids 的舊影片
//   - 這位沒有：名字相符，但排除同名其他女優在對照表裡的 ID
func actressVideoQuery(row avEntity.DMMActress, name string) (map[string]any, error) {
	siblings, err := avRepo.NewDMMActress().FindByNames(actressSearchDomains, []string{name})
	if err != nil {
		return nil, err
	}
	// MySQL collation 不分平假名／片假名（アイラ＝あいら），這裡再比一次完全相同的名字
	keys := []avRepo.ActressKey{{Domain: row.Domain, ID: row.ID}}
	for _, s := range siblings {
		if s.Name == name && (s.Domain != row.Domain || s.ID != row.ID) {
			keys = append(keys, avRepo.ActressKey{Domain: s.Domain, ID: s.ID})
		}
	}
	maps, err := avRepo.NewDMMActressMap().FindByActresses(keys)
	if err != nil {
		return nil, err
	}
	var own, claimed []string
	for _, m := range maps {
		if m.Domain == row.Domain && m.AID == row.ID {
			own = append(own, m.DMMID)
		} else if !slices.Contains(claimed, m.DMMID) {
			claimed = append(claimed, m.DMMID)
		}
	}

	byName := actressNameVideoQuery(name)
	if len(own) > 0 {
		// 名字也要相符：同一個 DMM ID 用別名發的作品歸到別名那一頁
		legacy := map[string]any{"bool": map[string]any{"must_not": map[string]any{"exists": map[string]any{"field": "actress_ids"}}}}
		return map[string]any{"bool": map[string]any{
			"must": []map[string]any{byName, {"bool": map[string]any{
				"should":               []map[string]any{{"terms": map[string]any{"actress_ids": own}}, legacy},
				"minimum_should_match": 1,
			}}},
		}}, nil
	}
	if len(claimed) == 0 {
		return byName, nil
	}
	return map[string]any{"bool": map[string]any{
		"must":     byName,
		"must_not": map[string]any{"terms": map[string]any{"actress_ids": claimed}},
	}}, nil
}
