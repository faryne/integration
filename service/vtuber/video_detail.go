package vtuber

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"time"

	"go.uber.org/zap"

	vtuberEntity "faryne.dev/model/entity/opendata/vtuber"
	"faryne.dev/model/enum"
	"faryne.dev/service/client"
	"faryne.dev/service/log"
)

const (
	videoDetailCacheKey = "vtuber:video:%s"
	videoDetailCacheTTL = 6 * time.Hour
	// 說明 API 是公開的，每查一部新影片花 1 unit；限制同一個 IP 每分鐘的次數，避免被拿來亂打燒光額度
	videoDetailRateLimit  = 60
	videoDetailRateWindow = time.Minute
)

var videoIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{11}$`)

// GetVideoDetail 影片 modal 的說明：點開時才查（videos.list，1 unit），Redis 快取 6 小時。影片不存在（私人、刪除）回 nil
func GetVideoDetail(ctx context.Context, videoID string) (*vtuberEntity.VideoDetail, error) {
	if !videoIDPattern.MatchString(videoID) {
		return nil, fmt.Errorf("%w: invalid video id", ErrInvalidRequest)
	}
	key := fmt.Sprintf(videoDetailCacheKey, videoID)
	r := client.GetRedis(enum.RedisDefault)
	if r != nil {
		if cached, err := r.Get(key).Bytes(); err == nil {
			var detail vtuberEntity.VideoDetail
			if json.Unmarshal(cached, &detail) == nil {
				return &detail, nil
			}
		}
	}

	api, err := newYouTubeService(ctx)
	if err != nil {
		return nil, err
	}
	resp, err := api.Videos.List([]string{"snippet"}).Id(videoID).Context(ctx).Do()
	if err != nil {
		return nil, fmt.Errorf("fetch youtube video: %w", err)
	}
	if len(resp.Items) == 0 || resp.Items[0].Snippet == nil {
		return nil, nil
	}
	detail := &vtuberEntity.VideoDetail{VideoID: videoID, Description: resp.Items[0].Snippet.Description}
	if r != nil {
		if body, err := json.Marshal(detail); err == nil {
			if err := r.Set(key, body, videoDetailCacheTTL).Err(); err != nil {
				log.Logger().Warn("Cache vtuber video detail failed", zap.Error(err))
			}
		}
	}
	return detail, nil
}

// AllowVideoDetailRequest 同一個 IP 每分鐘最多 60 次；Redis 異常時放行，不能因為限流壞掉就讓 modal 看不到說明
func AllowVideoDetailRequest(ip string) bool {
	key := "vtuber:ratelimit:video:" + ip
	allowed, err := client.AllowFixedWindow(client.GetRedis(enum.RedisDefault), key, videoDetailRateLimit, videoDetailRateWindow)
	if err != nil {
		log.Logger().Warn("Vtuber video detail rate limit unavailable, allowing request", zap.Error(err))
		return true
	}
	return allowed
}
