package vtuber

import (
	"context"
	"crypto/sha1"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"html"
	"slices"
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
	videoSearchPerPage  = 24
	videoSearchCacheTTL = 6 * time.Hour
	videoSearchCacheKey = "vtuber:video-search:%s:%s:%s:%s" // channel ID、排序、關鍵字 hash、page token
	// YouTube 搜尋額度用完（search.list 一次 100 unit）時寫這組 key，效期一天；期間藝人頁停用搜尋框、API 直接回 503
	videoSearchQuotaKey = "vtuber:video-search:quota-exhausted"
	videoSearchQuotaTTL = 24 * time.Hour
	// 單一 IP 每小時：最多 3 組（同一位藝人＋同一個關鍵字）、每組最多 20 頁；只有真的呼叫 YouTube 才算，讀快取不算
	videoSearchIPGroupsKey = "vtuber:video-search:ip:%s:groups"
	videoSearchIPPagesKey  = "vtuber:video-search:ip:%s:pages:%s"
	videoSearchMaxGroups   = 3
	videoSearchMaxPages    = 20
	videoSearchWindow      = time.Hour
)

var (
	// ErrVideoSearchLimited 這個 IP 這一小時的影片搜尋次數用完，controller 據此回 429
	ErrVideoSearchLimited = errors.New("video search limit reached")
	// ErrVideoSearchQuotaExhausted YouTube 搜尋額度用完，controller 據此回 503
	ErrVideoSearchQuotaExhausted = errors.New("youtube search quota exhausted")
	videoSearchOrders            = []string{"relevance", "date"}
)

// VideoSearchAvailable 今天的 YouTube 搜尋額度還有沒有；Redis 異常時當作有，真的用完會再由 API 擋下
func VideoSearchAvailable() bool {
	r := client.GetRedis(enum.RedisDefault)
	if r == nil {
		return true
	}
	n, err := r.Exists(videoSearchQuotaKey).Result()
	return err != nil || n == 0
}

// SearchChannelVideos 藝人頁的影片搜尋：YouTube search.list 限定這個頻道，不存 DB。
// 順序：額度旗標 → 快取 → IP 上限 → 呼叫 YouTube（成功才計次）。找不到頻道回 nil
func SearchChannelVideos(ctx context.Context, handle, keyword, order, pageToken, ip string) (*vtuberEntity.VideoPage, error) {
	keyword, err := normalizeKeyword(keyword)
	if err != nil {
		return nil, err
	}
	if keyword == "" {
		return nil, fmt.Errorf("%w: q is required", ErrInvalidRequest)
	}
	if order == "" {
		order = "relevance"
	}
	if !slices.Contains(videoSearchOrders, order) {
		return nil, fmt.Errorf("%w: order must be relevance or date", ErrInvalidRequest)
	}
	if len(pageToken) > maxPageTokenSize {
		return nil, fmt.Errorf("%w: page_token is too long", ErrInvalidRequest)
	}
	ch, err := vtuberRepository.GetActiveChannelByHandle(normalizeHandle(handle))
	if err != nil || ch == nil {
		return nil, err
	}
	if !VideoSearchAvailable() {
		return nil, ErrVideoSearchQuotaExhausted
	}

	keywordHash := shortHash(strings.ToLower(keyword))
	group := shortHash(ch.ChannelID + "|" + keywordHash)
	key := fmt.Sprintf(videoSearchCacheKey, ch.ChannelID, order, keywordHash, pageToken)
	r := client.GetRedis(enum.RedisDefault)
	if r != nil {
		if cached, err := r.Get(key).Bytes(); err == nil {
			var page vtuberEntity.VideoPage
			if json.Unmarshal(cached, &page) == nil {
				return &page, nil
			}
		}
	}
	if !allowVideoSearch(ip, group) {
		return nil, ErrVideoSearchLimited
	}

	api, err := newYouTubeService(ctx)
	if err != nil {
		return nil, err
	}
	resp, err := api.Search.List([]string{"snippet"}).ChannelId(ch.ChannelID).Q(keyword).Type("video").
		Order(order).MaxResults(videoSearchPerPage).PageToken(pageToken).Context(ctx).Do()
	if googleService.IsQuotaExceeded(err) {
		if r != nil {
			r.Set(videoSearchQuotaKey, "1", videoSearchQuotaTTL)
		}
		log.Logger().Warn("YouTube search quota exhausted, video search disabled for a day", zap.Error(err))
		return nil, ErrVideoSearchQuotaExhausted
	}
	if err != nil {
		return nil, fmt.Errorf("search youtube videos: %w", err)
	}
	recordVideoSearch(ip, group)

	page := &vtuberEntity.VideoPage{Videos: []vtuberEntity.VideoItem{}, NextPageToken: resp.NextPageToken}
	for _, item := range resp.Items {
		s := item.Snippet
		if item.Id == nil || item.Id.VideoId == "" || s == nil {
			continue
		}
		published, _ := time.Parse(time.RFC3339, s.PublishedAt)
		video := vtuberEntity.VideoItem{
			VideoID: item.Id.VideoId,
			// search.list 的標題是 HTML escape 過的（例如 &#39;），playlistItems 不是，統一還原
			Title:        html.UnescapeString(s.Title),
			ThumbnailURL: videoThumbnail(s.Thumbnails),
			PublishedAt:  published,
		}
		if s.LiveBroadcastContent == "live" || s.LiveBroadcastContent == "upcoming" {
			video.LiveBroadcastContent = s.LiveBroadcastContent
		}
		page.Videos = append(page.Videos, video)
	}
	if r != nil {
		if body, err := json.Marshal(page); err == nil {
			if err := r.Set(key, body, videoSearchCacheTTL).Err(); err != nil {
				log.Logger().Warn("Cache vtuber video search failed", zap.Error(err))
			}
		}
	}
	return page, nil
}

// allowVideoSearch 這個 IP 還能不能再呼叫一次 YouTube：新的組要沒超過 3 組、這組要沒超過 20 頁。
// 檢查與計次不是原子操作，同時送出的請求可能多算一兩次，影響不大；Redis 異常時放行
func allowVideoSearch(ip, group string) bool {
	r := client.GetRedis(enum.RedisDefault)
	if r == nil {
		return true
	}
	groupsKey := fmt.Sprintf(videoSearchIPGroupsKey, ip)
	known, err := r.SIsMember(groupsKey, group).Result()
	if err != nil {
		return true
	}
	if !known {
		if n, err := r.SCard(groupsKey).Result(); err == nil && n >= videoSearchMaxGroups {
			return false
		}
	}
	pages, _ := r.Get(fmt.Sprintf(videoSearchIPPagesKey, ip, group)).Int()
	return pages < videoSearchMaxPages
}

// recordVideoSearch 真的呼叫 YouTube 成功後才計次；兩組 key 都是第一次寫入時開始算一小時
func recordVideoSearch(ip, group string) {
	r := client.GetRedis(enum.RedisDefault)
	if r == nil {
		return
	}
	groupsKey := fmt.Sprintf(videoSearchIPGroupsKey, ip)
	if added, err := r.SAdd(groupsKey, group).Result(); err == nil && added > 0 {
		if ttl, err := r.TTL(groupsKey).Result(); err == nil && ttl < 0 {
			r.Expire(groupsKey, videoSearchWindow)
		}
	}
	pagesKey := fmt.Sprintf(videoSearchIPPagesKey, ip, group)
	if count, err := r.Incr(pagesKey).Result(); err == nil && count == 1 {
		r.Expire(pagesKey, videoSearchWindow)
	}
}

// shortHash 關鍵字等使用者輸入放進 Redis key 前先 hash，避免特殊字元與長度問題
func shortHash(s string) string {
	sum := sha1.Sum([]byte(s))
	return hex.EncodeToString(sum[:8])
}
