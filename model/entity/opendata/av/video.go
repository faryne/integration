package av

import (
	"faryne.dev/model/entity"
	"time"
)

type VideoQueryRequest struct {
	Year      int                    `query:"year"`
	Month     int                    `query:"month"`
	Day       int                    `query:"day"`
	StartDate *entity.OnlyDateFormat `query:"start_date"`
	EndDate   *entity.OnlyDateFormat `query:"end_date"`
	Keyword   string                 `query:"keyword"`
	// Tag 可複選（?tag=A&tag=B），結果需同時符合
	Tag     []string `query:"tag"`
	Actress string   `query:"actress"`
	// ActressKey 女優頁用「{domain}-{aid}」指定是哪一位，同名女優的新影片依 DMM 女優 ID 分開（規則見 service/av/actress_videos.go）
	ActressKey string `query:"actress_key"`
	// 以下為詳細頁 chip 用的精確篩選（對 .keyword 下 term）
	Maker    string `query:"maker"`
	Label    string `query:"label"`
	Series   string `query:"series"`
	Director string `query:"director"`
	No       string `query:"no"`
	Page     int    `query:"page"`
	// Shuffle 隨機排序（詳細頁追溯不到系列／女優時，隨機推薦近期作品用）
	Shuffle bool `query:"shuffle"`
}

type RawVideo struct {
	Version string `json:"@version"`
	Url     string `json:"url"`
	Type    string `json:"type"`
	No      string `json:"no"`
	VodDate string `json:"vod_date"`
	Images  []struct {
		Preview string `json:"preview"`
		Thumb   string `json:"thumb"`
	} `json:"images"`
	Thumb       string        `json:"thumb"`
	Title       string        `json:"title"`
	Labels      []string      `json:"labels"`
	Makers      []string      `json:"makers"`
	Vid         int           `json:"vid"`
	PublishDate interface{}   `json:"publish_date"`
	Tags        []string      `json:"tags"`
	Duration    int           `json:"duration"`
	Directors   []interface{} `json:"directors"`
	Series      []interface{} `json:"series"`
	Actresses   []string      `json:"actresses"`
	ActressIDs  []string      `json:"actress_ids"`
	Timestamp   time.Time     `json:"@timestamp"`
	MakerNo     string        `json:"maker_no"`
	IsOrphan    bool          `json:"is_orphan"`
}

type CleanVideo struct {
	Url     string `json:"url"`
	No      string `json:"no"`
	VodDate string `json:"vod_date"`
	Images  []struct {
		Preview string `json:"preview"`
		Thumb   string `json:"thumb"`
	} `json:"images"`
	Thumb       string        `json:"thumb"`
	Title       string        `json:"title"`
	Labels      []string      `json:"labels"`
	Makers      []string      `json:"makers"`
	PublishDate string        `json:"publish_date,omitempty"`
	Tags        []string      `json:"tags"`
	Duration    int           `json:"duration"`
	Directors   []interface{} `json:"directors"`
	Series      []interface{} `json:"series"`
	Actresses   []string      `json:"actresses"`
	// ActressIDs DMM 女優 ID，順序與 Actresses 一致；舊資料沒有（空陣列）
	ActressIDs []string `json:"actress_ids"`
	MakerNo    string   `json:"maker_no"`
	// IsOrphan 同步資料確定失敗，前端不顯示同步按鈕
	IsOrphan bool `json:"is_orphan,omitempty"`
}

// VideoFacetBucket 篩選統計的一個值與筆數
type VideoFacetBucket struct {
	Value string `json:"value"`
	Count int    `json:"count"`
}

// VideoFacets 目前搜尋條件下的常見標籤／發售商／系列／出演
type VideoFacets struct {
	Tags      []VideoFacetBucket `json:"tags"`
	Makers    []VideoFacetBucket `json:"makers"`
	Series    []VideoFacetBucket `json:"series"`
	Actresses []VideoFacetBucket `json:"actresses"`
}
