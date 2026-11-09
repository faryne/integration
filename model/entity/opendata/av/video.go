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
	Tag []string `query:"tag"`
	// AnyTag 可複選（?any_tag=A&any_tag=B），符合其中一個就算；女優頁從有多個類型條件的主題點進來時用
	AnyTag []string `query:"any_tag"`
	// Actress 出演可複選（?actress=A&actress=B），結果需同時出演（共演）
	Actress []string `query:"actress"`
	// 女優頁指定是哪一位（同 ActressQueryRequest）：同名女優的新影片依對照表裡的 DMM 女優 ID 分開，
	// 對不到時退回 Actress（名字）；只在剛好一位出演時生效，規則見 service/av/actress_videos.go
	XCityID  int    `query:"xcity_id"`
	ManualID int    `query:"manual_id"`
	DMMID    string `query:"dmm_id"`
	// 以下為精確篩選（對 .keyword 比對），可複選、符合其中一個就算：一部片通常只有一個發售商／品牌，取交集一定沒結果
	Maker    []string `query:"maker"`
	Label    []string `query:"label"`
	Series   []string `query:"series"`
	Director []string `query:"director"`
	// DurationMin／DurationMax 片長範圍（分鐘），0 表示不限；有設時沒有片長資料的影片會被排除
	DurationMin int    `query:"duration_min"`
	DurationMax int    `query:"duration_max"`
	No          string `query:"no"`
	// Sort 排序：空字串新到舊，其他見 VideoSortOldest／VideoSortSoonest／VideoSortPopular
	Sort string `query:"sort"`
	Page int    `query:"page"`
	// Shuffle 隨機排序（詳細頁追溯不到系列／女優時，隨機推薦近期作品用）
	Shuffle bool `query:"shuffle"`
}

// 影片搜尋的排序（VideoQueryRequest.Sort）；空字串是依配信日新到舊
const (
	// VideoSortOldest 配信日舊到新
	VideoSortOldest = "oldest"
	// VideoSortSoonest 配信日近的在前、同一天依 DMM 收藏數（即將發售）
	VideoSortSoonest = "soonest"
	// VideoSortPopular 依 DMM 收藏數（即將發售：下週發售）
	VideoSortPopular = "popular"
)

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
	// ReleaseStatus 預約作品（即將發售索引）是 PRE_ORDER；影片索引的文件沒有這個欄位
	ReleaseStatus string `json:"release_status"`
	// Links 核准過的參考連結（影片修改審核）；DMM 沒有這個欄位
	Links []ActressLink `json:"links"`
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
	// Links 參考連結，詳細頁「基本資料」最後一列
	Links []ActressLink `json:"links"`
	// ReleaseStatus 預約作品是 PRE_ORDER（影片頁顯示「預約中」、不顯示相關作品）；已配信的是空字串
	ReleaseStatus string `json:"release_status,omitempty"`
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
