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
	googleService "faryne.dev/service/google"
	"faryne.dev/service/log"
)

const (
	videosPerPage = 24
	// 第一頁可能出現新上傳的影片，快取短一點；後面的頁幾乎不會變，快取久一點省 quota。
	// 代價：新影片上傳後整份清單往後擠一格，舊的後頁快取在交界可能重複或少一部
	videosFirstPageTTL = 30 * time.Minute
	videosLaterPageTTL = 6 * time.Hour
	videosCacheKey     = "vtuber:videos:%s:%s:%s" // channel ID、分類、page token
	maxPageTokenSize   = 128
)

// videoPlaylistPrefixes 「所有影片」的分類 → YouTube 上傳清單的字首（取代頻道 ID 開頭的 UC）。
// UU 是官方的上傳清單；UULV／UULF／UUSH 是沒有公開文件、但廣泛使用的分類清單，三者加起來等於 UU。
// 會員限定（UUMO）刻意不提供：非會員點了也播不了
var videoPlaylistPrefixes = map[string]string{
	"all":   "UU",
	"live":  "UULV", // 直播存檔
	"video": "UULF", // 一般影片（不含直播、Shorts）
	"short": "UUSH", // Shorts
}

// ListChannelVideos 藝人頁「所有影片」：依分類讀頻道的上傳清單，一頁 24 部。
// 只有使用者打開藝人頁、而且 Redis 沒有快取時才會打 YouTube（每頁 1 unit），不存 DB。找不到頻道回 nil。
func ListChannelVideos(ctx context.Context, handle, videoType, pageToken string) (*vtuberEntity.VideoPage, error) {
	// 先檢查參數，不合法就不用查 DB
	if _, err := uploadsPlaylistID("", videoType); err != nil {
		return nil, err
	}
	if len(pageToken) > maxPageTokenSize {
		return nil, fmt.Errorf("%w: page_token is too long", ErrInvalidRequest)
	}
	ch, err := vtuberRepository.GetActiveChannelByHandle(normalizeHandle(handle))
	if err != nil || ch == nil {
		return nil, err
	}
	playlistID, _ := uploadsPlaylistID(ch.ChannelID, videoType)

	key := fmt.Sprintf(videosCacheKey, ch.ChannelID, normalizeVideoType(videoType), pageToken)
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
	page := &vtuberEntity.VideoPage{Videos: []vtuberEntity.VideoItem{}}
	resp, err := api.PlaylistItems.List([]string{"snippet"}).PlaylistId(playlistID).
		MaxResults(videosPerPage).PageToken(pageToken).Context(ctx).Do()
	switch {
	case googleService.IsNotFound(err):
		// 這個分類沒有任何影片時（例如頻道從沒發過 Shorts），YouTube 回 404，當成空清單
	case err != nil:
		return nil, fmt.Errorf("fetch youtube uploads: %w", err)
	default:
		page.NextPageToken = resp.NextPageToken
		for _, item := range resp.Items {
			s := item.Snippet
			// 私人或已刪除的影片沒有縮圖，直接略過
			if s == nil || s.ResourceId == nil || s.Thumbnails == nil {
				continue
			}
			published, _ := time.Parse(time.RFC3339, s.PublishedAt)
			page.Videos = append(page.Videos, vtuberEntity.VideoItem{VideoID: s.ResourceId.VideoId, Title: s.Title, ThumbnailURL: videoThumbnail(s.Thumbnails), PublishedAt: published})
		}
	}
	if r != nil {
		if body, err := json.Marshal(page); err == nil {
			if err := r.Set(key, body, videosCacheTTL(pageToken)).Err(); err != nil {
				log.Logger().Warn("Cache vtuber videos failed", zap.Error(err))
			}
		}
	}
	return page, nil
}

// normalizeVideoType 沒給分類就是全部
func normalizeVideoType(videoType string) string {
	if videoType = strings.TrimSpace(videoType); videoType == "" {
		return "all"
	}
	return videoType
}

// uploadsPlaylistID 分類對應的上傳清單 ID：字首＋頻道 ID 去掉開頭的 UC
func uploadsPlaylistID(channelID, videoType string) (string, error) {
	prefix, ok := videoPlaylistPrefixes[normalizeVideoType(videoType)]
	if !ok {
		return "", fmt.Errorf("%w: unknown type %q, must be one of all, live, video, short", ErrInvalidRequest, videoType)
	}
	return prefix + strings.TrimPrefix(channelID, "UC"), nil
}

// videosCacheTTL 第一頁（沒有 page token）快取短、後面的頁快取長
func videosCacheTTL(pageToken string) time.Duration {
	if pageToken == "" {
		return videosFirstPageTTL
	}
	return videosLaterPageTTL
}
