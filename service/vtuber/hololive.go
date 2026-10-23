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

	"github.com/aws/aws-sdk-go-v2/aws"
	awsConfig "github.com/aws/aws-sdk-go-v2/config"
	"github.com/aws/aws-sdk-go-v2/credentials"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"go.uber.org/zap"
	"google.golang.org/api/youtube/v3"

	"faryne.dev/config"
	vtuberEntity "faryne.dev/model/entity/opendata/vtuber"
	vtuberRepository "faryne.dev/repository/vtuber"
	"faryne.dev/service/log"
)

const (
	hololiveTalentsURL  = "https://hololive.hololivepro.com/talents/"
	hololiveS3Key       = "vtuber/hololive.json"
	talentFetchInterval = 500 * time.Millisecond
	// 這次爬到的頻道數不到在籍數的這個比例，就不做畢業判斷（官網改版爬空時保護名冊）
	graduationGuardRatio = 0.8
)

var (
	// 官網列表頁的藝人連結曾由絕對網址改成相對路徑，兩種寫法都要吃
	talentLinkPattern       = regexp.MustCompile(`href="(?:https://hololive\.hololivepro\.com)?/talents/([a-z0-9-]+)/"`)
	talentUnitLinkPattern   = regexp.MustCompile(`href="/talents\?gp=([a-zA-Z0-9_-]+)"`)
	talentSNSBlockPattern   = regexp.MustCompile(`(?s)<ul class="t_sns[^"]*">(.*?)</ul>`)
	youtubeChannelIDPattern = regexp.MustCompile(`youtube\.com/channel/(UC[a-zA-Z0-9_-]+)`)
	youtubeHandlePattern    = regexp.MustCompile(`youtube\.com/(@[a-zA-Z0-9_.-]+)`)
)

// talentRef 官網上的一位藝人：個人頁 slug、列表頁順序、YouTube 頻道參照（UC 頻道 ID 或 @handle）
type talentRef struct {
	Slug       string
	Order      int
	ChannelRef string
}

// SyncTalentChannels 爬取 hololive 官網藝人列表與分組，取得各自 YouTube 頻道資訊後寫入 CDN 與 vtuber_channels
func SyncTalentChannels(ctx context.Context) (int, error) {
	listPage, err := fetchHTML(ctx, hololiveTalentsURL)
	if err != nil {
		return 0, fmt.Errorf("fetch talents page: %w", err)
	}
	talents := scrapeTalentChannelRefs(ctx, parseTalentSlugs(listPage))
	if len(talents) == 0 {
		return 0, fmt.Errorf("no youtube channel found from %s", hololiveTalentsURL)
	}
	units, excluded := scrapeTalentUnits(ctx, parseUnitSlugs(listPage))

	api, err := newYouTubeService(ctx)
	if err != nil {
		return 0, err
	}
	byRef, err := fetchYouTubeChannels(ctx, api, talents)
	if err != nil {
		return 0, err
	}

	// 同一個頻道只留第一次出現的那位（官網順序）
	rows := make([]vtuberEntity.Channel, 0, len(talents))
	channels := make([]*youtube.Channel, 0, len(talents))
	seenID := make(map[string]struct{}, len(talents))
	for _, t := range talents {
		ch, ok := byRef[t.ChannelRef]
		if !ok {
			continue
		}
		if _, dup := seenID[ch.Id]; dup {
			continue
		}
		seenID[ch.Id] = struct{}{}
		// 畢業生與工作人員照舊寫進 CDN 檔案，但不進名冊（已在名冊的會被畢業判斷 soft delete）
		if !excluded[t.Slug] {
			row := channelEntity(ch)
			row.TalentSlug, row.SortOrder, row.UnitSlug = t.Slug, uint(t.Order), optional(units[t.Slug])
			rows = append(rows, row)
		}
		// CDN 檔案拿掉說明避免肥大；DB 已經在上一行留了完整說明
		stripDescription(ch)
		channels = append(channels, ch)
	}

	// 先寫 DB（網站與行事曆都靠它），CDN 檔案寫失敗不影響名冊
	if err := saveChannels(rows); err != nil {
		return 0, err
	}
	if err := writeFile(hololiveS3Key, channels); err != nil {
		return len(rows), fmt.Errorf("write %s: %w", hololiveS3Key, err)
	}
	return len(rows), nil
}

// saveChannels 寫入名冊並做畢業判斷：這次沒爬到的在籍頻道 soft delete
func saveChannels(rows []vtuberEntity.Channel) error {
	active, err := vtuberRepository.ListActiveChannels()
	if err != nil {
		return err
	}
	if err := vtuberRepository.UpsertChannels(rows, vtuberRepository.ScrapedColumns); err != nil {
		return err
	}
	if !graduationAllowed(len(rows), len(active)) {
		log.Logger().Warn("Skip hololive graduation check: too few channels scraped", zap.Int("scraped", len(rows)), zap.Int("active", len(active)))
		return nil
	}
	keep := make([]string, len(rows))
	for i, r := range rows {
		keep[i] = r.ChannelID
	}
	removed, err := vtuberRepository.SoftDeleteChannelsExcept(keep)
	if removed > 0 {
		log.Logger().Info("Hololive channels graduated", zap.Int64("count", removed))
	}
	return err
}

// graduationAllowed 爬到的數量至少是在籍數的 80% 才信任這次結果
func graduationAllowed(scraped, active int) bool {
	return scraped > 0 && float64(scraped) >= float64(active)*graduationGuardRatio
}

// parseTalentSlugs 列表頁上所有藝人個人頁的 slug，依頁面順序去重
func parseTalentSlugs(body string) []string {
	seen := make(map[string]struct{})
	var slugs []string
	for _, match := range talentLinkPattern.FindAllStringSubmatch(body, -1) {
		slug := match[1]
		if _, ok := seen[slug]; ok || slug == "feed" {
			continue
		}
		seen[slug] = struct{}{}
		slugs = append(slugs, slug)
	}
	return slugs
}

// parseUnitSlugs 列表頁上的分組連結（/talents?gp=<slug>），依頁面順序去重
func parseUnitSlugs(body string) []string {
	seen := make(map[string]struct{})
	var slugs []string
	for _, match := range talentUnitLinkPattern.FindAllStringSubmatch(body, -1) {
		slug := match[1]
		if _, ok := seen[slug]; ok {
			continue
		}
		seen[slug] = struct{}{}
		slugs = append(slugs, slug)
	}
	return slugs
}

// scrapeTalentChannelRefs 逐一進藝人個人頁擷取 YouTube 頻道參照；沒有個人頻道的跳過
func scrapeTalentChannelRefs(ctx context.Context, slugs []string) []talentRef {
	talents := make([]talentRef, 0, len(slugs))
	for i, slug := range slugs {
		channelRef, err := scrapeTalentChannelRef(ctx, slug)
		switch {
		case err != nil:
			log.Logger().Warn("Scrape hololive talent channel failed", zap.String("slug", slug), zap.Error(err))
		case channelRef == "":
			log.Logger().Warn("Hololive talent has no personal youtube channel", zap.String("slug", slug))
		default:
			talents = append(talents, talentRef{Slug: slug, Order: i, ChannelRef: channelRef})
		}
		time.Sleep(talentFetchInterval)
	}
	return talents
}

// scrapeTalentUnits 逐一抓分組頁，回傳藝人 slug → 期別 slug，以及不追蹤的藝人（excludedUnits 的成員）。
// 一位藝人在好幾組時取 Units 順序最前面的那組；不在 Units 表裡的新分組照樣記錄，但會 warn 提醒補表。
func scrapeTalentUnits(ctx context.Context, unitSlugs []string) (map[string]string, map[string]bool) {
	units, excluded := make(map[string]string), make(map[string]bool)
	for _, unit := range unitSlugs {
		if !excludedUnits[unit] && FindUnit(unit) == nil {
			log.Logger().Warn("Unknown hololive unit, please add it to vtuber.Units", zap.String("unit", unit))
		}
		body, err := fetchHTML(ctx, hololiveTalentsURL+"?gp="+unit)
		if err != nil {
			log.Logger().Warn("Scrape hololive unit failed", zap.String("unit", unit), zap.Error(err))
			continue
		}
		members := parseTalentSlugs(body)
		if excludedUnits[unit] {
			for _, slug := range members {
				excluded[slug] = true
			}
		} else {
			assignUnit(units, unit, members)
		}
		time.Sleep(talentFetchInterval)
	}
	return units, excluded
}

// assignUnit 把 talents 歸到 unit；已經有更前面的期別就不覆蓋
func assignUnit(out map[string]string, unit string, talents []string) {
	for _, slug := range talents {
		if current, ok := out[slug]; !ok || unitRank(unit) < unitRank(current) {
			out[slug] = unit
		}
	}
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

// fetchYouTubeChannels 回傳頻道參照 → 頻道
// @handle 格式的參照無法走批次 Id() 查詢，需逐一以 ForHandle 解析
func fetchYouTubeChannels(ctx context.Context, api *youtube.Service, talents []talentRef) (map[string]*youtube.Channel, error) {
	byRef := make(map[string]*youtube.Channel, len(talents))
	channelIDs := make([]string, 0, len(talents))
	for _, t := range talents {
		ref := t.ChannelRef
		if !strings.HasPrefix(ref, "@") {
			channelIDs = append(channelIDs, ref)
			continue
		}
		resp, err := api.Channels.List(channelParts).ForHandle(strings.TrimPrefix(ref, "@")).Context(ctx).Do()
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

	byID, err := listChannelsByIDs(ctx, api, channelIDs)
	if err != nil {
		return nil, err
	}
	for id, ch := range byID {
		byRef[id] = ch
	}
	return byRef, nil
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
