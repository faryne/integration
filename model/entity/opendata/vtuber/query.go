package vtuber

import "time"

// LiveRequest 查直播；From／To 是 RFC 3339 或 YYYY-MM-DD，沒給時由 service 補預設區間。
// Channel 是 MCP 用的關鍵字（頻道 ID、@handle 或名稱的一部分），API 只開放 ChannelID。
type LiveRequest struct {
	ChannelID string `json:"channel_id" query:"channel_id"`
	Channel   string `json:"channel" query:"-"`
	Status    string `json:"status" query:"status"`
	From      string `json:"from" query:"from"`
	To        string `json:"to" query:"to"`
}

// LiveItem 對外輸出的直播；時間一律 RFC 3339 UTC
type LiveItem struct {
	VideoID             string     `json:"video_id"`
	ChannelID           string     `json:"channel_id"`
	ChannelTitle        string     `json:"channel_title"`
	ChannelHandle       string     `json:"channel_handle"`
	ChannelThumbnailURL string     `json:"channel_thumbnail_url"`
	Title               string     `json:"title"`
	ThumbnailURL        string     `json:"thumbnail_url"`
	Status              string     `json:"status"`
	ScheduledStartAt    *time.Time `json:"scheduled_start_at"`
	ActualStartAt       *time.Time `json:"actual_start_at"`
	ActualEndAt         *time.Time `json:"actual_end_at"`
	ConcurrentViewers   *uint      `json:"concurrent_viewers"`
	UpdatedAt           time.Time  `json:"updated_at"`
}

// LiveQueryResult 附上實際套用的區間，讓呼叫端（含 MCP）知道查了哪段時間
type LiveQueryResult struct {
	From  time.Time  `json:"from"`
	To    time.Time  `json:"to"`
	Lives []LiveItem `json:"lives"`
}

// Unit 官網分組（期別），Branch 是 JP／EN／ID／DEV_IS
type Unit struct {
	Slug   string `json:"slug"`
	Name   string `json:"name"`
	Branch string `json:"branch"`
}

// CalendarLinks 公開 Google 行事曆的各種連結
type CalendarLinks struct {
	CalendarID   string `json:"calendar_id"`
	SubscribeURL string `json:"subscribe_url"` // 加入 Google 日曆
	EmbedURL     string `json:"embed_url"`     // 嵌入／網頁檢視（agenda 模式）
	ICSURL       string `json:"ics_url"`       // Apple Calendar 等用戶端訂閱
}

// ChannelSummary 藝人選擇列與全部藝人面板用的精簡資料
type ChannelSummary struct {
	ChannelID    string `json:"channel_id"`
	Handle       string `json:"handle"`
	Title        string `json:"title"`
	ThumbnailURL string `json:"thumbnail_url"`
	UnitSlug     string `json:"unit_slug"`
	IsLive       bool   `json:"is_live"`
	IsGraduated  bool   `json:"is_graduated"`
}

// ChannelListResult 頻道列表＋分組常數表（總表行事曆 ID 前端寫死，不經 API）
type ChannelListResult struct {
	Units    []Unit           `json:"units"`
	Channels []ChannelSummary `json:"channels"`
}

// ChannelDetail 藝人頁左側的完整頻道資訊
type ChannelDetail struct {
	ChannelSummary
	Unit               *Unit          `json:"unit"`
	Description        string         `json:"description"`
	BannerURL          string         `json:"banner_url"`
	TrailerVideoID     string         `json:"trailer_video_id"`
	ChannelPublishedAt *time.Time     `json:"channel_published_at"`
	YouTubeURL         string         `json:"youtube_url"`
	OfficialURL        string         `json:"official_url"`
	SubscriberCount    uint64         `json:"subscriber_count"`
	ViewCount          uint64         `json:"view_count"`
	VideoCount         uint64         `json:"video_count"`
	SubscriberDelta7d  *int64         `json:"subscriber_delta_7d"` // 統計資料不足時為 null
	SubscriberDelta90d *int64         `json:"subscriber_delta_90d"`
	Calendar           *CalendarLinks `json:"calendar"`
}

// VideoItem 「所有影片」：頻道上傳清單（含直播存檔）的一部
type VideoItem struct {
	VideoID      string    `json:"video_id"`
	Title        string    `json:"title"`
	ThumbnailURL string    `json:"thumbnail_url"`
	PublishedAt  time.Time `json:"published_at"`
}

// VideoDetail 影片 modal 點開時才查：說明＋直接打開影片網址時組 modal 需要的資料（SEO 也用這份）
type VideoDetail struct {
	VideoID      string     `json:"video_id"`
	Title        string     `json:"title"`
	Description  string     `json:"description"`
	ThumbnailURL string     `json:"thumbnail_url"`
	PublishedAt  *time.Time `json:"published_at"`
	ChannelID    string     `json:"channel_id"`
	// 以下不進快取：頻道資訊從 DB 補，live 每次讀 vtuber_lives，狀態才是即時的
	ChannelTitle        string     `json:"channel_title"`
	ChannelHandle       string     `json:"channel_handle"`
	ChannelThumbnailURL string     `json:"channel_thumbnail_url"`
	Live                *VideoLive `json:"live"` // 不是直播（或還沒偵測到）時為 null
}

// VideoLive 影片在 vtuber_lives 的直播狀態；時間一律 RFC 3339 UTC
type VideoLive struct {
	Status            string     `json:"status"`
	ScheduledStartAt  *time.Time `json:"scheduled_start_at"`
	ActualStartAt     *time.Time `json:"actual_start_at"`
	ActualEndAt       *time.Time `json:"actual_end_at"`
	ConcurrentViewers *uint      `json:"concurrent_viewers"`
}

// VideoPage 一頁影片；NextPageToken 空字串代表沒有下一頁
type VideoPage struct {
	Videos        []VideoItem `json:"videos"`
	NextPageToken string      `json:"next_page_token"`
}
