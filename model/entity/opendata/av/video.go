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
	Tag       string                 `query:"tag"`
	Actress   string                 `query:"actress"`
	// 以下為詳細頁 chip 用的精確篩選（對 .keyword 下 term）
	Maker    string `query:"maker"`
	Label    string `query:"label"`
	Series   string `query:"series"`
	Director string `query:"director"`
	No       string `query:"no"`
	Page     int    `query:"page"`
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
	MakerNo     string        `json:"maker_no"`
	// IsOrphan 同步資料確定失敗，前端不顯示同步按鈕
	IsOrphan bool `json:"is_orphan,omitempty"`
}
