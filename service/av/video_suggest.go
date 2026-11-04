package av

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"
	"strings"
	"time"

	"faryne.dev/config"
	avEntity "faryne.dev/model/entity/opendata/av"
	"faryne.dev/model/enum"
	"faryne.dev/service/client"
)

const (
	videoSuggestSize        = 10
	videoSuggestMaxQueryLen = 30
	videoSuggestCacheKey    = "av:video-suggest:%s:%s"
	videoSuggestCacheTTL    = time.Hour
)

// ES regexp 的保留字元，使用者輸入要先跳脫才能放進 include
var esRegexpEscaper = strings.NewReplacer(
	`\`, `\\`, `.`, `\.`, `?`, `\?`, `+`, `\+`, `*`, `\*`, `|`, `\|`, `{`, `\{`, `}`, `\}`,
	`[`, `\[`, `]`, `\]`, `(`, `\(`, `)`, `\)`, `"`, `\"`, `#`, `\#`, `@`, `\@`, `&`, `\&`,
	`<`, `\<`, `>`, `\>`, `~`, `\~`,
)

// VideoTermSuggest 影片修改表單陣列欄位的 autocomplete：包含輸入字的值，依作品數排序取前 10 個。
// 先用 wildcard 縮小到有這個字的影片，再對這些影片做 terms aggregation（include 再過濾一次，
// 因為同一部影片的其他值不一定包含輸入字）；結果快取 1 小時
func VideoTermSuggest(ctx context.Context, field, q string) ([]avEntity.VideoFacetBucket, error) {
	if !slices.Contains(avEntity.VideoTermFields, field) {
		return nil, invalidActress("不支援的欄位：%s", field)
	}
	q = truncateRunes(strings.TrimSpace(q), videoSuggestMaxQueryLen)
	r := client.GetRedis(enum.RedisDefault)
	cacheKey := fmt.Sprintf(videoSuggestCacheKey, field, q)
	if r != nil {
		var cached []avEntity.VideoFacetBucket
		if raw, err := r.Get(cacheKey).Bytes(); err == nil && json.Unmarshal(raw, &cached) == nil {
			return cached, nil
		}
	}

	key := field + ".keyword"
	agg := termsAgg(key, videoSuggestSize)
	body := map[string]any{"size": 0, "aggs": map[string]any{"values": agg}}
	if q != "" {
		agg["terms"].(map[string]any)["include"] = ".*" + esRegexpEscaper.Replace(q) + ".*"
		body["query"] = map[string]any{"wildcard": map[string]any{key: map[string]any{"value": "*" + wildcardEscaper.Replace(q) + "*"}}}
	}
	var res struct {
		Aggregations struct {
			Values struct {
				Buckets []struct {
					Key      string `json:"key"`
					DocCount int    `json:"doc_count"`
				} `json:"buckets"`
			} `json:"values"`
		} `json:"aggregations"`
	}
	if err := esSearch(ctx, config.EnvConfig().DMMVideoIndex, body, &res); err != nil {
		return nil, err
	}
	out := make([]avEntity.VideoFacetBucket, 0, len(res.Aggregations.Values.Buckets))
	for _, b := range res.Aggregations.Values.Buckets {
		out = append(out, avEntity.VideoFacetBucket{Value: b.Key, Count: b.DocCount})
	}
	if r != nil {
		if raw, err := json.Marshal(out); err == nil {
			r.Set(cacheKey, raw, videoSuggestCacheTTL)
		}
	}
	return out, nil
}
