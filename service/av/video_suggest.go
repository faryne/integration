package av

import (
	"context"
	"encoding/json"
	"fmt"
	"slices"
	"strings"
	"time"

	avEntity "faryne.dev/model/entity/opendata/av"
	"faryne.dev/model/enum"
	avRepo "faryne.dev/repository/av"
	"faryne.dev/service/client"
)

const (
	videoSuggestSize        = 10
	videoSuggestMaxQueryLen = 30
	videoSuggestCacheKey    = "av:video-suggest:%s:%s"
	videoSuggestCacheTTL    = time.Hour
)

// VideoTermSuggest 影片修改表單陣列欄位的 autocomplete：包含輸入字的值，依作品數排序取前 10 個；結果快取 1 小時
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

	var contains []string
	if q != "" {
		contains = []string{q}
	}
	out, err := avRepo.NewVideoIndex().Terms(ctx, field, videoSuggestSize, contains...)
	if err != nil {
		return nil, err
	}
	if r != nil {
		if raw, err := json.Marshal(out); err == nil {
			r.Set(cacheKey, raw, videoSuggestCacheTTL)
		}
	}
	return out, nil
}
