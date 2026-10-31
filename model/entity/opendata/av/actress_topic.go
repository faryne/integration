package av

// ActressTopicConditions 自訂主題（身材、特輯）的條件：同一欄位內多個值是 OR，不同欄位之間是 AND。
// 區間一律 [min, max]，0（罩杯是空字串）代表不限；沒填的欄位不檢查。
// 第 1、2 階段寫在程式裡，第 3 階段存進 DB 的 conditions JSON，兩邊共用這個結構
type ActressTopicConditions struct {
	Horoscope          []string                     `json:"horoscope,omitempty"`
	Blood              []string                     `json:"blood,omitempty"`
	BirthYear          [2]int                       `json:"birth_year,omitzero"`
	Height             [2]int                       `json:"height,omitzero"`
	Cup                [2]string                    `json:"cup,omitzero"`
	Bust               [2]int                       `json:"bust,omitzero"`
	Waist              [2]int                       `json:"waist,omitzero"`
	Hips               [2]int                       `json:"hips,omitzero"`
	HipWaistDiff       [2]int                       `json:"hip_waist_diff,omitzero"`
	BornCity           []string                     `json:"born_city,omitempty"`
	Genres             []ActressTopicGenreCondition `json:"genres,omitempty"`
	DebutWithinMonths  int                          `json:"debut_within_months,omitempty"`
	ActiveWithinMonths int                          `json:"active_within_months,omitempty"`
	MinVideos          int                          `json:"min_videos,omitempty"`
}

// ActressTopicGenreCondition 某個影片類型（DMM 標籤）至少出演幾部；部數不含總集編
type ActressTopicGenreCondition struct {
	Tag string `json:"tag"`
	Min int    `json:"min"`
}

// ActressTopicIndex S3 上的 index.json：總覽頁的分組與主題清單，前端也用它把 slug 對到檔名
type ActressTopicIndex struct {
	GeneratedAt string              `json:"generated_at"`
	Groups      []ActressTopicGroup `json:"groups"`
}

type ActressTopicGroup struct {
	Key    string                `json:"key"`
	Label  string                `json:"label"`
	Topics []ActressTopicSummary `json:"topics"`
}

type ActressTopicSummary struct {
	Slug  string `json:"slug"`
	Label string `json:"label"`
	Count int    `json:"count"`
	File  string `json:"file"`
	// Summary 自訂主題的條件摘要（例如「F cup 以上・臀 90 以上」），內建主題留空
	Summary string `json:"summary,omitempty"`
	// GenreTags 主題的全部類型條件（類型主題就是標籤本身）；女優頁從這個主題點進來時，每個類型各開一個「該類型作品」的 tab
	GenreTags []string `json:"genre_tags,omitempty"`
}

// ActressTopicFile 單一主題的檔案；排序與分頁都由前端處理
type ActressTopicFile struct {
	Slug        string `json:"slug"`
	Label       string `json:"label"`
	GeneratedAt string `json:"generated_at"`
	DefaultSort string `json:"default_sort"`
	// GenreTag 卡片上「熟女 88 部」的類型名稱：類型主題是標籤本身，自訂主題是第一個類型條件；沒有就省略
	GenreTag  string               `json:"genre_tag,omitempty"`
	Actresses []ActressTopicMember `json:"actresses"`
}

// ActressTopicMember 主題卡片需要的欄位；GenreCount 只有類型主題、或有類型條件的自訂主題才有
type ActressTopicMember struct {
	Domain       string `json:"domain"`
	AID          int    `json:"aid"`
	Name         string `json:"name"`
	Photo        string `json:"photo"`
	VideoCount   int    `json:"video_count"`
	FirstVodDate string `json:"first_vod_date,omitempty"`
	LastVodDate  string `json:"last_vod_date,omitempty"`
	GenreCount   int    `json:"genre_count,omitempty"`
}
