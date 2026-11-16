package av

import (
	"slices"

	avEntity "faryne.dev/model/entity/opendata/av"
	"faryne.dev/service/search"
)

// actressesByAliases 依別名找女優（joyu 影片頁出演卡：本名對不到時才用，例如用別名「由愛可奈」發片，資料庫本名是「水川潤」）。
// 回傳 別名 → 掛這個別名的女優；同一個別名有兩位以上時呼叫端要當作分不出是誰
func actressesByAliases(names []string) (map[string][]avEntity.Actress, error) {
	out := map[string][]avEntity.Actress{}
	if len(names) == 0 {
		return out, nil
	}
	q := map[string]any{"size": len(names) * 3}
	search.SetQuery(actressDomainQuery(actressSearchDomains), true, q)
	search.SetQuery(map[string]any{"terms": map[string]any{"aliases.keyword": names}}, true, q)
	_, rows, err := search.Search[avEntity.Actress, avEntity.Actress](actressIndexName(), q, fActress)
	if err != nil {
		return nil, err
	}
	for _, a := range rows {
		for _, alias := range a.Aliases {
			if slices.Contains(names, alias) {
				out[alias] = append(out[alias], a)
			}
		}
	}
	return out, nil
}
