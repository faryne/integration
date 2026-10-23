package vtuber

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"sync"
	"time"

	"go.uber.org/zap"
	"golang.org/x/sync/errgroup"

	vtuberEntity "faryne.dev/model/entity/opendata/vtuber"
	"faryne.dev/service/log"
)

const (
	rssURL     = "https://www.youtube.com/feeds/videos.xml?channel_id="
	rssWorkers = 8
	rssTimeout = 15 * time.Second
)

// RSS 每個 entry 都有 <yt:videoId>；只要影片 ID，用 regex 比解整份 Atom 省事
var rssVideoIDPattern = regexp.MustCompile(`<yt:videoId>([A-Za-z0-9_-]{11})</yt:videoId>`)

var rssClient = &http.Client{Timeout: rssTimeout}

// collectRSSVideoIDs 並行抓各頻道 RSS（每個頻道最近 15 部），回傳去重後的影片 ID。
// 單一頻道失敗只 warn，不影響其他頻道。
func collectRSSVideoIDs(ctx context.Context, channels []vtuberEntity.Channel) []string {
	var (
		mu   sync.Mutex
		seen = make(map[string]struct{})
		out  []string
	)
	g, ctx := errgroup.WithContext(ctx)
	g.SetLimit(rssWorkers)
	for _, ch := range channels {
		g.Go(func() error {
			ids, err := fetchRSSVideoIDs(ctx, ch.ChannelID)
			if err != nil {
				log.Logger().Warn("Fetch youtube rss failed", zap.String("channel_id", ch.ChannelID), zap.Error(err))
				return nil
			}
			mu.Lock()
			defer mu.Unlock()
			for _, id := range ids {
				if _, ok := seen[id]; !ok {
					seen[id] = struct{}{}
					out = append(out, id)
				}
			}
			return nil
		})
	}
	_ = g.Wait()
	return out
}

func fetchRSSVideoIDs(ctx context.Context, channelID string) ([]string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, rssURL+channelID, nil)
	if err != nil {
		return nil, err
	}
	resp, err := rssClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("unexpected status %s", resp.Status)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	return parseRSSVideoIDs(string(body)), nil
}

func parseRSSVideoIDs(body string) []string {
	matches := rssVideoIDPattern.FindAllStringSubmatch(body, -1)
	ids := make([]string, len(matches))
	for i, m := range matches {
		ids[i] = m[1]
	}
	return ids
}
