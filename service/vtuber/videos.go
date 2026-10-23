package vtuber

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"go.uber.org/zap"

	vtuberEntity "faryne.dev/model/entity/opendata/vtuber"
	"faryne.dev/model/enum"
	vtuberRepository "faryne.dev/repository/vtuber"
	"faryne.dev/service/client"
	"faryne.dev/service/log"
)

const (
	videosPerPage    = 24
	videosCacheTTL   = 30 * time.Minute
	videosCacheKey   = "vtuber:videos:%s:%s" // channel ID、page token
	maxPageTokenSize = 128
)

// ListChannelVideos 藝人頁「所有影片」：讀頻道的上傳清單（含直播存檔），一頁 24 部，Redis 快取 30 分鐘。
// 只有使用者打開藝人頁才會打 YouTube（每頁 1 unit），不存 DB。找不到頻道回 nil。
func ListChannelVideos(ctx context.Context, handle, pageToken string) (*vtuberEntity.VideoPage, error) {
	if len(pageToken) > maxPageTokenSize {
		return nil, fmt.Errorf("page_token is too long")
	}
	ch, err := vtuberRepository.GetActiveChannelByHandle(normalizeHandle(handle))
	if err != nil || ch == nil {
		return nil, err
	}
	key := fmt.Sprintf(videosCacheKey, ch.ChannelID, pageToken)
	r := client.GetRedis(enum.RedisDefault)
	if r != nil {
		if cached, err := r.Get(key).Bytes(); err == nil {
			var page vtuberEntity.VideoPage
			if json.Unmarshal(cached, &page) == nil {
				return &page, nil
			}
		}
	}

	api, err := newYouTubeService(ctx)
	if err != nil {
		return nil, err
	}
	// 上傳清單的 ID 是頻道 ID 把開頭的 UC 換成 UU
	resp, err := api.PlaylistItems.List([]string{"snippet"}).PlaylistId("UU" + strings.TrimPrefix(ch.ChannelID, "UC")).
		MaxResults(videosPerPage).PageToken(pageToken).Context(ctx).Do()
	if err != nil {
		return nil, fmt.Errorf("fetch youtube uploads: %w", err)
	}
	page := &vtuberEntity.VideoPage{Videos: make([]vtuberEntity.VideoItem, 0, len(resp.Items)), NextPageToken: resp.NextPageToken}
	for _, item := range resp.Items {
		s := item.Snippet
		// 私人或已刪除的影片沒有縮圖，直接略過
		if s == nil || s.ResourceId == nil || s.Thumbnails == nil {
			continue
		}
		published, _ := time.Parse(time.RFC3339, s.PublishedAt)
		page.Videos = append(page.Videos, vtuberEntity.VideoItem{VideoID: s.ResourceId.VideoId, Title: s.Title, ThumbnailURL: videoThumbnail(s.Thumbnails), PublishedAt: published})
	}
	if r != nil {
		if body, err := json.Marshal(page); err == nil {
			if err := r.Set(key, body, videosCacheTTL).Err(); err != nil {
				log.Logger().Warn("Cache vtuber videos failed", zap.Error(err))
			}
		}
	}
	return page, nil
}
