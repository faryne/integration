package av

import (
	"context"
	"strings"

	"faryne.dev/model/entity/opendata/av"
	"faryne.dev/repository/search"
	esdsl "faryne.dev/service/search"
)

// FindByNos 依番號取影片：舊資料的 no 是大寫、同步過或新資料是小寫，兩種都放進 terms
func (videoIndexES) FindByNos(_ context.Context, nos []string, page int, byDate bool) (search.Page[av.RawVideo], error) {
	if len(nos) == 0 {
		return search.Page[av.RawVideo]{}, nil
	}
	values := make([]string, 0, len(nos)*2)
	for _, no := range nos {
		values = append(values, strings.ToLower(no), strings.ToUpper(no))
	}
	q := map[string]any{"query": map[string]any{"terms": map[string]any{"no.keyword": values}}}
	if byDate {
		page = max(page, 1)
		q["size"], q["from"] = videoPageSize, (page-1)*videoPageSize
		q["sort"] = []any{map[string]any{"vod_date": map[string]any{"order": "desc"}}}
	} else {
		q["size"] = len(nos)
	}
	r, _, err := esdsl.Search[av.RawVideo, av.RawVideo](videoIndexName(), q)
	if err != nil {
		return search.Page[av.RawVideo]{}, err
	}
	out := search.Page[av.RawVideo]{Total: r.Hits.Total.Value, Hits: make([]search.Hit[av.RawVideo], 0, len(r.Hits.Hits))}
	for _, h := range r.Hits.Hits {
		out.Hits = append(out.Hits, search.Hit[av.RawVideo]{ID: h.Id, Source: h.Source})
	}
	return out, nil
}
