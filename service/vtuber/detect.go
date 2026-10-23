package vtuber

import (
	"context"
	"fmt"
	"slices"
	"sync/atomic"
	"time"

	"go.uber.org/zap"
	"google.golang.org/api/youtube/v3"

	vtuberEntity "faryne.dev/model/entity/opendata/vtuber"
	"faryne.dev/model/enum"
	vtuberRepository "faryne.dev/repository/vtuber"
	"faryne.dev/service/client"
	"faryne.dev/service/log"
)

const (
	seenKeyPrefix = "vtuber:seen:"
	seenTTL       = 30 * 24 * time.Hour
	// 預定時間在這之後的待機室視為「フリーチャット」（常駐聊天室），不收
	freeChatHorizon = 60 * 24 * time.Hour
	// 每 5 分鐘跑一次，留 1 分鐘緩衝避免跟下一輪重疊
	detectTimeout = 4 * time.Minute
)

// detecting 上一輪還沒跑完就跳過這輪（cron 本身不會擋重疊）
var detecting atomic.Bool

// DetectLives 從 RSS 找新影片、重新確認追蹤中的直播，寫入 vtuber_lives
func DetectLives(ctx context.Context) error {
	channels, err := vtuberRepository.ListActiveChannels()
	if err != nil {
		return err
	}
	newIDs := filterUnseen(collectRSSVideoIDs(ctx, channels))
	tracking, err := vtuberRepository.ListTrackingVideoIDs()
	if err != nil {
		return err
	}
	ids := slices.Compact(slices.Sorted(slices.Values(append(slices.Clone(newIDs), tracking...))))
	if len(ids) == 0 {
		return nil
	}

	api, err := newYouTubeService(ctx)
	if err != nil {
		return err
	}
	videos, err := listVideos(ctx, api, ids)
	if err != nil {
		// 查詢失敗（例如 quota 用完）就不記 seen，下一輪這些影片會再查一次
		return err
	}

	now := time.Now()
	var lives []vtuberEntity.Live
	for _, id := range ids {
		if v, ok := videos[id]; ok {
			if live, ok := liveFromVideo(v, now); ok {
				lives = append(lives, live)
			}
		}
	}
	if err := vtuberRepository.UpsertLives(lives); err != nil {
		return err
	}
	if err := vtuberRepository.MarkLivesCancelled(cancelledIDs(tracking, videos, now), now); err != nil {
		return err
	}
	markSeen(newIDs)
	log.Logger().Info("Detect vtuber lives finished", zap.Int("new_videos", len(newIDs)), zap.Int("tracking", len(tracking)), zap.Int("lives", len(lives)))
	return nil
}

// cancelledIDs 追蹤中的直播：YouTube 查不到（轉私人、刪除），或已經不算直播（例如改成フリーチャット）
func cancelledIDs(tracking []string, videos map[string]*youtube.Video, now time.Time) []string {
	var out []string
	for _, id := range tracking {
		v, ok := videos[id]
		if !ok {
			out = append(out, id)
			continue
		}
		if _, isLive := liveFromVideo(v, now); !isLive {
			out = append(out, id)
		}
	}
	return out
}

// listVideos 50 筆一批查影片的直播資訊
func listVideos(ctx context.Context, api *youtube.Service, ids []string) (map[string]*youtube.Video, error) {
	out := make(map[string]*youtube.Video, len(ids))
	for start := 0; start < len(ids); start += youtubeBatch {
		resp, err := api.Videos.List([]string{"snippet", "liveStreamingDetails"}).Id(ids[start:min(start+youtubeBatch, len(ids))]...).Context(ctx).Do()
		if err != nil {
			return nil, fmt.Errorf("fetch youtube videos: %w", err)
		}
		for _, item := range resp.Items {
			out[item.Id] = item
		}
	}
	return out, nil
}

// liveFromVideo 把 YouTube 影片轉成直播；不是直播、沒有時間、或是フリーチャット時回 false
func liveFromVideo(v *youtube.Video, now time.Time) (vtuberEntity.Live, bool) {
	d := v.LiveStreamingDetails
	if d == nil || v.Snippet == nil {
		return vtuberEntity.Live{}, false
	}
	live := vtuberEntity.Live{
		VideoID:          v.Id,
		ChannelID:        v.Snippet.ChannelId,
		Title:            v.Snippet.Title,
		ScheduledStartAt: parseTime(d.ScheduledStartTime),
		ActualStartAt:    parseTime(d.ActualStartTime),
		ActualEndAt:      parseTime(d.ActualEndTime),
		ThumbnailURL:     videoThumbnail(v.Snippet.Thumbnails),
		CheckedAt:        now,
	}
	switch {
	case live.ActualEndAt != nil:
		live.Status = vtuberEntity.LiveStatusEnded
	case live.ActualStartAt != nil:
		live.Status = vtuberEntity.LiveStatusLive
		if d.ConcurrentViewers > 0 {
			viewers := uint(d.ConcurrentViewers)
			live.ConcurrentViewers = &viewers
		}
	case live.ScheduledStartAt == nil || live.ScheduledStartAt.After(now.Add(freeChatHorizon)):
		return vtuberEntity.Live{}, false
	default:
		live.Status = vtuberEntity.LiveStatusUpcoming
	}
	return live, true
}

func parseTime(value string) *time.Time {
	t, err := time.Parse(time.RFC3339, value)
	if err != nil {
		return nil
	}
	return &t
}

// videoThumbnail 取最大的縮圖
func videoThumbnail(th *youtube.ThumbnailDetails) string {
	if th == nil {
		return ""
	}
	for _, t := range []*youtube.Thumbnail{th.Maxres, th.Standard, th.High, th.Medium, th.Default} {
		if t != nil && t.Url != "" {
			return t.Url
		}
	}
	return ""
}

// filterUnseen 用 Redis 去掉已經查過的影片；Redis 不可用時全部當新的（只是多花一點 quota）
func filterUnseen(ids []string) []string {
	r := client.GetRedis(enum.RedisDefault)
	if r == nil || len(ids) == 0 {
		return ids
	}
	keys := make([]string, len(ids))
	for i, id := range ids {
		keys[i] = seenKeyPrefix + id
	}
	values, err := r.MGet(keys...).Result()
	if err != nil {
		log.Logger().Warn("Check seen vtuber videos failed", zap.Error(err))
		return ids
	}
	var out []string
	for i, v := range values {
		if v == nil {
			out = append(out, ids[i])
		}
	}
	return out
}

// markSeen 記下已經查過的影片，30 天內不再從 RSS 重查
func markSeen(ids []string) {
	r := client.GetRedis(enum.RedisDefault)
	if r == nil || len(ids) == 0 {
		return
	}
	pipe := r.Pipeline()
	for _, id := range ids {
		pipe.Set(seenKeyPrefix+id, 1, seenTTL)
	}
	if _, err := pipe.Exec(); err != nil {
		log.Logger().Warn("Mark seen vtuber videos failed", zap.Error(err))
	}
}

// RunDetectLives cron 進入點：偵測直播後接著同步 Google 行事曆
func RunDetectLives() {
	if !detecting.CompareAndSwap(false, true) {
		log.Logger().Warn("Skip vtuber live detection: previous run still in progress")
		return
	}
	defer detecting.Store(false)
	ctx, cancel := context.WithTimeout(context.Background(), detectTimeout)
	defer cancel()
	if err := DetectLives(ctx); err != nil {
		log.Logger().Error("Detect vtuber lives failed", zap.Error(err))
	}
	// 偵測失敗也照樣同步：MySQL 裡既有的資料仍可能有還沒寫進行事曆的變動
	if err := SyncCalendars(ctx); err != nil {
		log.Logger().Error("Sync vtuber calendars failed", zap.Error(err))
	}
}
