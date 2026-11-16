package av

import (
	"slices"

	avEntity "faryne.dev/model/entity/opendata/av"
	"faryne.dev/service/search"
)

// ActressAliasPhotos joyu 影片頁出演女優卡：本名對不到的出演者（例如用別名「由愛可奈」發片，資料庫本名是「水川潤」），
// 改用別名找這位的照片。只回照片，不回女優資料：別名是另一個名義，追蹤、罩杯、連結都照舊各自分開（使用者 2026-11-16 決定）。
// 回傳 key 是傳進來的原始名字；別名對不到、或同一個別名掛在多位女優身上（分不出是誰）的不會出現
func ActressAliasPhotos(credits []string) (map[string]string, error) {
	if len(credits) > actressNamesLimit {
		credits = credits[:actressNamesLimit]
	}
	names := make([]string, 0, len(credits))
	for _, c := range credits {
		if name := actressBaseName(c); name != "" && !slices.Contains(names, name) {
			names = append(names, name)
		}
	}
	out := map[string]string{}
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
	// 別名 → 掛這個別名的女優；同一個別名有兩位以上就不給照片
	byAlias := map[string][]avEntity.Actress{}
	for _, a := range rows {
		for _, alias := range a.Aliases {
			if slices.Contains(names, alias) {
				byAlias[alias] = append(byAlias[alias], a)
			}
		}
	}
	for _, c := range credits {
		if rows := byAlias[actressBaseName(c)]; len(rows) == 1 && rows[0].Photo != "" {
			out[c] = rows[0].Photo
		}
	}
	return out, nil
}
