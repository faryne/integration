package vtuber

import (
	"context"
	"fmt"
	"time"

	"go.uber.org/zap"

	vtuberEntity "faryne.dev/model/entity/opendata/vtuber"
	vtuberRepository "faryne.dev/repository/vtuber"
	"faryne.dev/service/log"
)

// liveCountsWindow 結束多久內的直播每天更新觀看與按讚數；之後就不動，數字約等於「結束後一週」，場次之間才比得了
const liveCountsWindow = 7 * 24 * time.Hour

// ListChannelLiveHistory 藝人頁直播統計：最近 days 天（預設 90、上限 365，跟每日統計一樣）已結束的直播；找不到頻道回 nil
func ListChannelLiveHistory(handle string, days int) ([]vtuberEntity.LiveHistoryItem, error) {
	if days <= 0 {
		days = defaultStatDays
	}
	if days > maxStatDays {
		return nil, fmt.Errorf("%w: days is at most %d", ErrInvalidRequest, maxStatDays)
	}
	ch, err := vtuberRepository.GetActiveChannelByHandle(normalizeHandle(handle))
	if err != nil || ch == nil {
		return nil, err
	}
	lives, err := vtuberRepository.ListEndedLives(ch.ChannelID, time.Now().AddDate(0, 0, -days))
	if err != nil {
		return nil, err
	}
	return liveHistoryItems(lives), nil
}

// liveHistoryItems 轉成對外格式；缺開始或結束時間的略過（理論上已結束的都有）
func liveHistoryItems(lives []vtuberEntity.Live) []vtuberEntity.LiveHistoryItem {
	out := make([]vtuberEntity.LiveHistoryItem, 0, len(lives))
	for _, l := range lives {
		if l.ActualStartAt == nil || l.ActualEndAt == nil {
			continue
		}
		out = append(out, vtuberEntity.LiveHistoryItem{
			VideoID: l.VideoID, Title: l.Title, ThumbnailURL: l.ThumbnailURL,
			ActualStartAt: l.ActualStartAt.UTC(), ActualEndAt: l.ActualEndAt.UTC(),
			PeakViewers: l.PeakViewers, ViewCount: l.ViewCount, LikeCount: l.LikeCount,
		})
	}
	return out
}

// RunRefreshLiveCounts cron 進入點
func RunRefreshLiveCounts() {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()
	if err := RefreshRecentLiveCounts(ctx); err != nil {
		log.Logger().Error("Refresh vtuber live counts failed", zap.Error(err))
		return
	}
	log.Logger().Info("Refresh vtuber live counts finished")
}

// RefreshRecentLiveCounts 更新最近結束的直播的觀看與按讚數。
// 沿用偵測的 listVideos／liveFromVideo／UpsertLives，峰值與其他欄位照同一套規則合併；
// 查不到的（轉私人、刪除）只是略過，不在這裡改狀態
func RefreshRecentLiveCounts(ctx context.Context) error {
	ids, err := vtuberRepository.ListEndedVideoIDsSince(time.Now().Add(-liveCountsWindow))
	if err != nil || len(ids) == 0 {
		return err
	}
	api, err := newYouTubeService(ctx)
	if err != nil {
		return err
	}
	videos, err := listVideos(ctx, api, ids)
	if err != nil {
		return err
	}
	now := time.Now()
	lives := make([]vtuberEntity.Live, 0, len(videos))
	for _, v := range videos {
		if live, ok := liveFromVideo(v, now); ok {
			lives = append(lives, live)
		}
	}
	return vtuberRepository.UpsertLives(lives)
}
