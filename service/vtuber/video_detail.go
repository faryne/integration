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
	vtuberRepository "faryne.dev/repository/vtuber"
	"faryne.dev/service/client"
	"faryne.dev/service/log"
)

const (
	videoDetailCacheKey = "vtuber:video:v2:%s" // v2：多存標題／縮圖／頻道，舊格式的快取不能沿用
	videoDetailCacheTTL = 6 * time.Hour
	// 說明 API 是公開的，每查一部新影片花 1 unit；限制同一個 IP 每分鐘的次數，避免被拿來亂打燒光額度
	videoDetailRateLimit  = 60
	videoDetailRateWindow = time.Minute
)

var videoIDPattern = regexp.MustCompile(`^[A-Za-z0-9_-]{11}$`)

// GetVideoDetail 影片 modal（含直接打開影片網址）與 SEO 用：YouTube 那段（videos.list，1 unit）Redis 快取 6 小時，
// 頻道與直播狀態每次從 DB 補。影片不存在（私人、刪除）或不是追蹤中的頻道都回 nil，不當成任意 YouTube 影片的代理
func GetVideoDetail(ctx context.Context, videoID string) (*vtuberEntity.VideoDetail, error) {
	detail, err := fetchVideoSnippet(ctx, videoID)
	if err != nil || detail == nil {
		return nil, err
	}
	ch, err := vtuberRepository.GetActiveChannelByID(detail.ChannelID)
	if err != nil || ch == nil {
		return nil, err
	}
	detail.ChannelTitle, detail.ChannelHandle, detail.ChannelThumbnailURL = ch.Title, ch.Handle(), ch.ThumbnailURL
	live, err := vtuberRepository.GetLive(videoID)
	if err != nil {
		return nil, err
	}
	if live != nil {
		detail.Live = &vtuberEntity.VideoLive{
			Status: live.Status, ScheduledStartAt: utc(live.ScheduledStartAt), ActualStartAt: utc(live.ActualStartAt),
			ActualEndAt: utc(live.ActualEndAt), ConcurrentViewers: live.ConcurrentViewers,
		}
	}
	return detail, nil
}

// fetchVideoSnippet 只取 YouTube 端的標題／說明／縮圖／頻道；查不到也快取（存 null），同一個亂打的 ID 不會重複花 quota
func fetchVideoSnippet(ctx context.Context, videoID string) (*vtuberEntity.VideoDetail, error) {
	if !videoIDPattern.MatchString(videoID) {
		return nil, fmt.Errorf("%w: invalid video id", ErrInvalidRequest)
	}
	key := fmt.Sprintf(videoDetailCacheKey, videoID)
	r := client.GetRedis(enum.RedisDefault)
	if r != nil {
		if cached, err := r.Get(key).Bytes(); err == nil {
			var detail *vtuberEntity.VideoDetail
			if json.Unmarshal(cached, &detail) == nil {
				return detail, nil
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
	var detail *vtuberEntity.VideoDetail
	if len(resp.Items) > 0 && resp.Items[0].Snippet != nil {
		sn := resp.Items[0].Snippet
		detail = &vtuberEntity.VideoDetail{VideoID: videoID, Title: sn.Title, Description: sn.Description, ThumbnailURL: videoThumbnail(sn.Thumbnails), ChannelID: sn.ChannelId}
		if published, err := time.Parse(time.RFC3339, sn.PublishedAt); err == nil {
			detail.PublishedAt = &published
		}
	}
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
