package vtuber

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"
	"time"

	"faryne.dev/config"
	"faryne.dev/service/log"
	"github.com/aws/aws-sdk-go-v2/aws"
	awsConfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"go.uber.org/zap"
	"google.golang.org/api/option"
	"google.golang.org/api/youtube/v3"
)

const (
	hololiveTalentsURL  = "https://hololive.hololivepro.com/talents/"
	hololiveS3Key       = "vtuber/hololovie.json"
	youtubeChannelBatch = 50
	talentFetchInterval = 500 * time.Millisecond
)

var (
	talentLinkPattern       = regexp.MustCompile(`href="https://hololive\.hololivepro\.com/talents/([a-z0-9-]+)/"`)
	talentSNSBlockPattern   = regexp.MustCompile(`(?s)<ul class="t_sns[^"]*">(.*?)</ul>`)
	youtubeChannelIDPattern = regexp.MustCompile(`youtube\.com/channel/(UC[a-zA-Z0-9_-]+)`)
	youtubeHandlePattern    = regexp.MustCompile(`youtube\.com/(@[a-zA-Z0-9_.-]+)`)
)

// SyncTalentChannels 爬取 hololive 官網藝人列表，取得各自 YouTube 頻道資訊後寫入 CDN
func SyncTalentChannels(ctx context.Context) (int, error) {
	channelRefs, err := scrapeTalentChannelRefs(ctx)
	if err != nil {
		return 0, err
	}
	if len(channelRefs) == 0 {
		return 0, fmt.Errorf("no youtube channel found from %s", hololiveTalentsURL)
	}

	channels, err := fetchYouTubeChannels(ctx, channelRefs)
	if err != nil {
		return 0, err
	}

	if err := writeFile(hololiveS3Key, channels); err != nil {
		return 0, err
	}
	return len(channels), nil
}

// scrapeTalentChannelRefs 從藝人列表頁取得所有子頁面，再逐一擷取個人 YouTube 頻道參照（UC 頻道 ID 或 @handle）
func scrapeTalentChannelRefs(ctx context.Context) ([]string, error) {
	body, err := fetchHTML(ctx, hololiveTalentsURL)
	if err != nil {
		return nil, fmt.Errorf("fetch talents page: %w", err)
	}

	seenSlug := make(map[string]struct{})
	var slugs []string
	for _, match := range talentLinkPattern.FindAllStringSubmatch(body, -1) {
		slug := match[1]
		if slug == "feed" {
			continue
		}
		if _, ok := seenSlug[slug]; ok {
			continue
		}
		seenSlug[slug] = struct{}{}
		slugs = append(slugs, slug)
	}

	seenChannel := make(map[string]struct{})
	channelRefs := make([]string, 0, len(slugs))
	for _, slug := range slugs {
		channelRef, err := scrapeTalentChannelRef(ctx, slug)
		if err != nil {
			log.Logger().Warn("Scrape hololive talent channel failed", zap.String("slug", slug), zap.Error(err))
			continue
		}
		if channelRef == "" {
			log.Logger().Warn("Hololive talent has no personal youtube channel", zap.String("slug", slug))
			continue
		}
		if _, ok := seenChannel[channelRef]; !ok {
			seenChannel[channelRef] = struct{}{}
			channelRefs = append(channelRefs, channelRef)
		}
		time.Sleep(talentFetchInterval)
	}
	return channelRefs, nil
}

// scrapeTalentChannelRef 從藝人個人頁的 SNS 區塊（t_sns）擷取 YouTube 頻道參照
// 個人頁 footer 也有一個 hololive 官方頻道連結，需限定在 t_sns 區塊內避免誤抓
// YouTube 連結有 /channel/UC... 跟新式 /@handle 兩種格式，兩種都要處理
func scrapeTalentChannelRef(ctx context.Context, slug string) (string, error) {
	body, err := fetchHTML(ctx, hololiveTalentsURL+slug+"/")
	if err != nil {
		return "", err
	}
	block := talentSNSBlockPattern.FindStringSubmatch(body)
	if block == nil {
		return "", fmt.Errorf("sns block not found")
	}
	if match := youtubeChannelIDPattern.FindStringSubmatch(block[1]); match != nil {
		return match[1], nil
	}
	if match := youtubeHandlePattern.FindStringSubmatch(block[1]); match != nil {
		return match[1], nil
	}
	return "", nil
}

func fetchHTML(ctx context.Context, url string) (string, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (compatible; faryne.dev vtuber job)")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("unexpected status %s", resp.Status)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return "", err
	}
	return string(body), nil
}

// fetchYouTubeChannels 以 50 筆一批呼叫 YouTube Data API，並依 channelRefs 原始順序輸出
// @handle 格式的參照無法走批次 Id() 查詢，需逐一以 ForHandle 解析
func fetchYouTubeChannels(ctx context.Context, channelRefs []string) ([]*youtube.Channel, error) {
	key := strings.TrimSpace(config.EnvConfig().YouTubeAPIKey)
	if key == "" {
		return nil, fmt.Errorf("YOUTUBE_API_KEY is required")
	}
	api, err := youtube.NewService(ctx, option.WithAPIKey(key))
	if err != nil {
		return nil, err
	}

	parts := []string{"brandingSettings", "snippet", "statistics"}
	byRef := make(map[string]*youtube.Channel, len(channelRefs))
	channelIDs := make([]string, 0, len(channelRefs))
	for _, ref := range channelRefs {
		if !strings.HasPrefix(ref, "@") {
			channelIDs = append(channelIDs, ref)
			continue
		}
		resp, err := api.Channels.List(parts).ForHandle(strings.TrimPrefix(ref, "@")).Context(ctx).Do()
		if err != nil {
			log.Logger().Warn("Resolve youtube handle failed", zap.String("handle", ref), zap.Error(err))
			continue
		}
		if len(resp.Items) != 1 {
			log.Logger().Warn("Youtube handle not found", zap.String("handle", ref))
			continue
		}
		byRef[ref] = resp.Items[0]
	}

	for start := 0; start < len(channelIDs); start += youtubeChannelBatch {
		end := min(start+youtubeChannelBatch, len(channelIDs))
		resp, err := api.Channels.List(parts).Id(channelIDs[start:end]...).Context(ctx).Do()
		if err != nil {
			return nil, fmt.Errorf("fetch youtube channels: %w", err)
		}
		byID := make(map[string]*youtube.Channel, len(resp.Items))
		for _, item := range resp.Items {
			byID[item.Id] = item
		}
		for _, id := range channelIDs[start:end] {
			if channel, ok := byID[id]; ok {
				byRef[id] = channel
			}
		}
	}

	channels := make([]*youtube.Channel, 0, len(channelRefs))
	seenID := make(map[string]struct{}, len(channelRefs))
	for _, ref := range channelRefs {
		channel, ok := byRef[ref]
		if !ok {
			continue
		}
		if _, dup := seenID[channel.Id]; dup {
			continue
		}
		seenID[channel.Id] = struct{}{}
		stripDescription(channel)
		channels = append(channels, channel)
	}
	return channels, nil
}

// stripDescription 移除頻道描述欄位，避免輸出檔案過於肥大
func stripDescription(channel *youtube.Channel) {
	if channel.Snippet != nil {
		channel.Snippet.Description = ""
		if channel.Snippet.Localized != nil {
			channel.Snippet.Localized.Description = ""
		}
	}
	if channel.BrandingSettings != nil && channel.BrandingSettings.Channel != nil {
		channel.BrandingSettings.Channel.Description = ""
	}
}

func initS3Client(ctx context.Context) (*s3.Client, error) {
	staticProvider := credentials.NewStaticCredentialsProvider(config.EnvConfig().S3AccessKey, config.EnvConfig().S3SecretKey, "")
	cfg, err := awsConfig.LoadDefaultConfig(ctx,
		awsConfig.WithRegion(config.EnvConfig().S3Region),
		awsConfig.WithCredentialsProvider(staticProvider),
	)
	if err != nil {
		return nil, fmt.Errorf("load aws config: %w", err)
	}
	return s3.NewFromConfig(cfg), nil
}

func writeFile(fileName string, data any) error {
	body, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return err
	}
	ctx := context.Background()
	client, err := initS3Client(ctx)
	if err != nil {
		return err
	}
	_, err = client.PutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(config.EnvConfig().S3Bucket),
		Key:         aws.String(fileName),
		Body:        bytes.NewReader(body),
		ContentType: aws.String("application/json"),
	})
	return err
}

// RunSyncTalentChannels cron 進入點
func RunSyncTalentChannels() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()
	count, err := SyncTalentChannels(ctx)
	if err != nil {
		log.Logger().Error("Sync hololive talent channels failed", zap.Error(err))
		return
	}
	log.Logger().Info("Sync hololive talent channels finished", zap.Int("channels", count))
}
