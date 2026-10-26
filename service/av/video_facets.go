package av

import (
	"faryne.dev/config"
	"faryne.dev/model/entity/opendata/av"
	"faryne.dev/service/search"
)

// 每組統計回傳的數量：標籤種類多所以多給一些
const (
	facetTagSize   = 15
	facetOtherSize = 10
)

// VideoFacets 依目前搜尋條件統計常見的標籤／發售商／系列／出演（terms aggregation），
// 讓搜尋頁與 MCP 可以一步步縮小範圍；條件組裝與 VideoSearch 共用 applyVideoConditions
func VideoFacets(input av.VideoQueryRequest) (av.VideoFacets, error) {
	q := map[string]any{
		"size": 0,
		"aggs": map[string]any{
			"tags":      termsAgg("tags.keyword", facetTagSize),
			"makers":    termsAgg("makers.keyword", facetOtherSize),
			"series":    termsAgg("series.keyword", facetOtherSize),
			"actresses": termsAgg("actresses.keyword", facetOtherSize),
		},
	}
	applyVideoConditions(input, q)

	r, _, err := search.Search[av.RawVideo, av.CleanVideo](config.EnvConfig().DMMVideoIndex, q)
	if err != nil {
		return av.VideoFacets{}, err
	}
	buckets := func(name string) []av.VideoFacetBucket {
		out := make([]av.VideoFacetBucket, 0)
		for _, b := range r.Aggregations[name].Buckets {
			out = append(out, av.VideoFacetBucket{Value: b.Key, Count: b.DocCount})
		}
		return out
	}
	return av.VideoFacets{
		Tags:      buckets("tags"),
		Makers:    buckets("makers"),
		Series:    buckets("series"),
		Actresses: buckets("actresses"),
	}, nil
}

// termsAgg 舊資料的系列／發售商常是空字串，統計時排除
func termsAgg(field string, size int) map[string]any {
	return map[string]any{"terms": map[string]any{"field": field, "size": size, "exclude": ""}}
}
