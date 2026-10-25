package vtuber

import (
	"errors"
	"fmt"
	"net/url"
	"slices"
	"strings"
	"time"

	vtuberEntity "faryne.dev/model/entity/opendata/vtuber"
	vtuberRepository "faryne.dev/repository/vtuber"
)

const (
	defaultLivesBefore = 24 * time.Hour      // 沒給 from：從一天前開始（今天已結束的也看得到）
	defaultLivesAfter  = 14 * 24 * time.Hour // 沒給 to：往後兩週
	maxLivesRange      = 31 * 24 * time.Hour
	defaultStatDays    = 90
	maxStatDays        = 365
	officialTalentURL  = "https://hololive.hololivepro.com/talents/"
)

// ErrInvalidRequest 參數錯誤（狀態、時間區間、天數），controller 據此回 400
var ErrInvalidRequest = errors.New("invalid request")

var liveStatuses = []string{vtuberEntity.LiveStatusUpcoming, vtuberEntity.LiveStatusLive, vtuberEntity.LiveStatusEnded, vtuberEntity.LiveStatusCancelled}

// QueryLives 查直播（API 與 MCP 共用）：補預設區間、檢查狀態與區間長度
func QueryLives(req vtuberEntity.LiveRequest) (*vtuberEntity.LiveQueryResult, error) {
	channels, err := vtuberRepository.ListActiveChannels()
	if err != nil {
		return nil, err
	}
	filter, err := normalizeLiveRequest(req, time.Now(), channels)
	if err != nil {
		return nil, fmt.Errorf("%w: %w", ErrInvalidRequest, err)
	}
	byID := make(map[string]vtuberEntity.Channel, len(channels))
	for _, ch := range channels {
		byID[ch.ChannelID] = ch
	}
	lives, err := vtuberRepository.FindLives(filter)
	if err != nil {
		return nil, err
	}
	items := make([]vtuberEntity.LiveItem, 0, len(lives))
	for _, l := range lives {
		ch, ok := byID[l.ChannelID]
		if !ok {
			continue // 畢業的頻道不顯示
		}
		items = append(items, vtuberEntity.LiveItem{
			VideoID: l.VideoID, ChannelID: l.ChannelID, ChannelTitle: ch.Title, ChannelHandle: ch.Handle(), ChannelThumbnailURL: ch.ThumbnailURL,
			Title: l.Title, ThumbnailURL: l.ThumbnailURL, Status: l.Status,
			ScheduledStartAt: utc(l.ScheduledStartAt), ActualStartAt: utc(l.ActualStartAt), ActualEndAt: utc(l.ActualEndAt),
			ConcurrentViewers: l.ConcurrentViewers, UpdatedAt: l.UpdatedAt.UTC(),
		})
	}
	return &vtuberEntity.LiveQueryResult{From: filter.From.UTC(), To: filter.To.UTC(), Lives: items}, nil
}

func normalizeLiveRequest(req vtuberEntity.LiveRequest, now time.Time, channels []vtuberEntity.Channel) (vtuberRepository.LiveFilter, error) {
	filter := vtuberRepository.LiveFilter{Status: strings.TrimSpace(req.Status)}
	if id := strings.TrimSpace(req.ChannelID); id != "" {
		filter.ChannelIDs = []string{id}
	}
	if keyword := strings.TrimSpace(req.Channel); keyword != "" {
		if filter.ChannelIDs = matchChannels(channels, keyword); len(filter.ChannelIDs) == 0 {
			return filter, fmt.Errorf("no channel matches %q", keyword)
		}
	}
	if filter.Status != "" && !slices.Contains(liveStatuses, filter.Status) {
		return filter, fmt.Errorf("unknown status %q, must be one of %s", filter.Status, strings.Join(liveStatuses, ", "))
	}
	var err error
	if filter.From, err = parseOptionalTime(req.From, now.Add(-defaultLivesBefore)); err != nil {
		return filter, fmt.Errorf("invalid from: %w", err)
	}
	if filter.To, err = parseOptionalTime(req.To, filter.From.Add(defaultLivesBefore+defaultLivesAfter)); err != nil {
		return filter, fmt.Errorf("invalid to: %w", err)
	}
	switch span := filter.To.Sub(filter.From); {
	case span < 0:
		return filter, fmt.Errorf("from is after to")
	case span > maxLivesRange:
		return filter, fmt.Errorf("time range is at most %d days", int(maxLivesRange.Hours()/24))
	}
	return filter, nil
}

// matchChannels 頻道 ID 或 @handle 完全相同，或名稱包含關鍵字（不分大小寫）的頻道
func matchChannels(channels []vtuberEntity.Channel, keyword string) []string {
	lower := strings.ToLower(keyword)
	var ids []string
	for _, ch := range channels {
		if ch.ChannelID == keyword || strings.EqualFold(ch.Handle(), normalizeHandle(keyword)) || strings.Contains(strings.ToLower(ch.Title), lower) {
			ids = append(ids, ch.ChannelID)
		}
	}
	return ids
}

// parseOptionalTime 接受 RFC 3339 或 YYYY-MM-DD（視為 Asia/Taipei 當天 00:00）；空字串用預設值
func parseOptionalTime(value string, fallback time.Time) (time.Time, error) {
	if value = strings.TrimSpace(value); value == "" {
		return fallback, nil
	}
	if t, err := time.Parse(time.RFC3339, value); err == nil {
		return t, nil
	}
	return time.ParseInLocation(time.DateOnly, value, taipei)
}

func utc(t *time.Time) *time.Time {
	if t == nil {
		return nil
	}
	u := t.UTC()
	return &u
}

// ListChannels 藝人選擇列與全部藝人面板：在籍頻道（官網順序）、是否直播中、分組表
func ListChannels() (*vtuberEntity.ChannelListResult, error) {
	channels, err := vtuberRepository.ListActiveChannels()
	if err != nil {
		return nil, err
	}
	liveIDs, err := vtuberRepository.ListLiveChannelIDs()
	if err != nil {
		return nil, err
	}
	out := &vtuberEntity.ChannelListResult{Units: Units, Channels: make([]vtuberEntity.ChannelSummary, 0, len(channels))}
	for _, ch := range channels {
		out.Channels = append(out.Channels, channelSummary(ch, slices.Contains(liveIDs, ch.ChannelID)))
	}
	return out, nil
}

func channelSummary(ch vtuberEntity.Channel, isLive bool) vtuberEntity.ChannelSummary {
	unit := ""
	if ch.UnitSlug != nil {
		unit = *ch.UnitSlug
	}
	return vtuberEntity.ChannelSummary{ChannelID: ch.ChannelID, Handle: ch.Handle(), Title: ch.Title, ThumbnailURL: ch.ThumbnailURL, UnitSlug: unit, IsLive: isLive, IsGraduated: ch.IsGraduated}
}

// GetChannelDetail 藝人頁左側；找不到頻道回 nil
func GetChannelDetail(handle string) (*vtuberEntity.ChannelDetail, error) {
	ch, err := vtuberRepository.GetActiveChannelByHandle(normalizeHandle(handle))
	if err != nil || ch == nil {
		return nil, err
	}
	liveIDs, err := vtuberRepository.ListLiveChannelIDs()
	if err != nil {
		return nil, err
	}
	stats, err := vtuberRepository.ListStats(ch.ChannelID, time.Now().In(taipei).AddDate(0, 0, -90).Format(time.DateOnly))
	if err != nil {
		return nil, err
	}
	detail := &vtuberEntity.ChannelDetail{
		ChannelSummary: channelSummary(*ch, slices.Contains(liveIDs, ch.ChannelID)),
		BannerURL:      ch.BannerURL, ChannelPublishedAt: utc(ch.ChannelPublishedAt),
		YouTubeURL:      "https://www.youtube.com/channel/" + ch.ChannelID,
		SubscriberCount: ch.SubscriberCount, ViewCount: ch.ViewCount, VideoCount: ch.VideoCount,
		SubscriberDelta7d: subscriberDelta(stats, ch.SubscriberCount, 7), SubscriberDelta90d: subscriberDelta(stats, ch.SubscriberCount, 90),
		Calendar:             calendarLinks(ch.Calendar()),
		VideoSearchAvailable: VideoSearchAvailable(),
	}
	if ch.UnitSlug != nil {
		detail.Unit = FindUnit(*ch.UnitSlug)
	}
	if ch.Description != nil {
		detail.Description = *ch.Description
	}
	if ch.TrailerVideoID != nil {
		detail.TrailerVideoID = *ch.TrailerVideoID
	}
	if ch.TalentSlug != "" {
		detail.OfficialURL = officialTalentURL + ch.TalentSlug + "/"
	}
	return detail, nil
}

// subscriberDelta 跟 days 天前（含以前最近一筆）的訂閱數相比；統計不夠久時回 nil
func subscriberDelta(stats []vtuberEntity.Stat, current uint64, days int) *int64 {
	if len(stats) == 0 {
		return nil
	}
	latest, err := time.Parse(time.DateOnly, stats[len(stats)-1].RecordDate)
	if err != nil {
		return nil
	}
	target := latest.AddDate(0, 0, -days).Format(time.DateOnly)
	for i := len(stats) - 1; i >= 0; i-- {
		if stats[i].RecordDate <= target {
			delta := int64(current) - int64(stats[i].SubscriberCount)
			return &delta
		}
	}
	return nil
}

// ListChannelStats 某頻道最近 days 天（預設 90、上限 365）的每日統計；找不到頻道回 nil
func ListChannelStats(handle string, days int) ([]vtuberEntity.Stat, error) {
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
	return vtuberRepository.ListStats(ch.ChannelID, time.Now().In(taipei).AddDate(0, 0, -days).Format(time.DateOnly))
}

// normalizeHandle 網址上可能帶或不帶 @
func normalizeHandle(handle string) string {
	if handle = strings.TrimSpace(handle); handle != "" && !strings.HasPrefix(handle, "@") {
		return "@" + handle
	}
	return handle
}

// calendarLinks 公開行事曆的訂閱／嵌入／ICS 連結；還沒有行事曆時回 nil
func calendarLinks(calendarID string) *vtuberEntity.CalendarLinks {
	if calendarID == "" {
		return nil
	}
	escaped := url.QueryEscape(calendarID)
	return &vtuberEntity.CalendarLinks{
		CalendarID:   calendarID,
		SubscribeURL: "https://calendar.google.com/calendar/r?cid=" + escaped,
		EmbedURL:     "https://calendar.google.com/calendar/embed?src=" + escaped + "&ctz=" + url.QueryEscape(calendarTimeZone) + "&mode=AGENDA",
		ICSURL:       "https://calendar.google.com/calendar/ical/" + url.PathEscape(calendarID) + "/public/basic.ics",
	}
}
