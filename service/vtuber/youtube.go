package vtuber

import (
	"context"
	"fmt"
	"strings"
	"time"

	"google.golang.org/api/option"
	"google.golang.org/api/youtube/v3"

	"faryne.dev/config"
	vtuberEntity "faryne.dev/model/entity/opendata/vtuber"
)

// YouTube Data API 一次最多查 50 筆
const youtubeBatch = 50

// channelParts 週更與每日統計共用；brandingSettings 有橫幅與頻道預告片
var channelParts = []string{"brandingSettings", "snippet", "statistics"}

func newYouTubeService(ctx context.Context) (*youtube.Service, error) {
	key := strings.TrimSpace(config.EnvConfig().YouTubeAPIKey)
	if key == "" {
		return nil, fmt.Errorf("YOUTUBE_API_KEY is required")
	}
	return youtube.NewService(ctx, option.WithAPIKey(key))
}

// listChannelsByIDs 50 筆一批查頻道，回傳 channel ID → 頻道
func listChannelsByIDs(ctx context.Context, api *youtube.Service, ids []string) (map[string]*youtube.Channel, error) {
	out := make(map[string]*youtube.Channel, len(ids))
	for start := 0; start < len(ids); start += youtubeBatch {
		resp, err := api.Channels.List(channelParts).Id(ids[start:min(start+youtubeBatch, len(ids))]...).Context(ctx).Do()
		if err != nil {
			return nil, fmt.Errorf("fetch youtube channels: %w", err)
		}
		for _, item := range resp.Items {
			out[item.Id] = item
		}
	}
	return out, nil
}

// channelEntity 把 YouTube 頻道資訊轉成 vtuber_channels 的欄位（官網來的 slug／順序／期別由呼叫端補）
func channelEntity(ch *youtube.Channel) vtuberEntity.Channel {
	out := vtuberEntity.Channel{ChannelID: ch.Id}
	if s := ch.Snippet; s != nil {
		out.Title = s.Title
		out.CustomURL = optional(s.CustomUrl)
		out.Description = optional(s.Description)
		if t, err := time.Parse(time.RFC3339, s.PublishedAt); err == nil {
			out.ChannelPublishedAt = &t
		}
		if th := s.Thumbnails; th != nil {
			for _, t := range []*youtube.Thumbnail{th.High, th.Medium, th.Default} {
				if t != nil && t.Url != "" {
					out.ThumbnailURL = t.Url
					break
				}
			}
		}
	}
	if b := ch.BrandingSettings; b != nil {
		if b.Image != nil {
			out.BannerURL = b.Image.BannerExternalUrl
		}
		if b.Channel != nil {
			out.TrailerVideoID = optional(b.Channel.UnsubscribedTrailer)
		}
	}
	if st := ch.Statistics; st != nil {
		out.SubscriberCount, out.ViewCount, out.VideoCount = st.SubscriberCount, st.ViewCount, st.VideoCount
	}
	return out
}

// optional 空字串轉 nil，讓 nullable 欄位存 NULL
func optional(s string) *string {
	if s = strings.TrimSpace(s); s == "" {
		return nil
	}
	return &s
}
