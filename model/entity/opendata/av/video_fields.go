package av

// VideoFields 影片開放修改的欄位：提交內容、dmm_video_overrides、ES dmmvideos 文件共用同一組 json key。
// 不加 omitempty，讓 diff／覆寫時每個欄位都有明確的值（0、空字串、空陣列）
type VideoFields struct {
	Title string `json:"title"`
	// MakerNo 官方番號；填了詳細頁就有 MissAV 連結、網址也會換成官方番號
	MakerNo string `json:"maker_no"`
	// VodDate／PublishDate 配信日／發售日，格式跟 DMM 同步一致（YYYY/MM/DD）
	VodDate     string   `json:"vod_date"`
	PublishDate string   `json:"publish_date"`
	Duration    int      `json:"duration"`
	Actresses   []string `json:"actresses"`
	Directors   []string `json:"directors"`
	Series      []string `json:"series"`
	Makers      []string `json:"makers"`
	Labels      []string `json:"labels"`
	Tags        []string `json:"tags"`
	// Links 參考連結，格式跟女優的一樣
	Links []ActressLink `json:"links"`
}

// VideoEditableFields 開放修改的欄位（json key），diff 與覆寫都照這個順序
var VideoEditableFields = []string{
	"title", "maker_no", "vod_date", "publish_date", "duration",
	"actresses", "directors", "series", "makers", "labels", "tags", "links",
}

// VideoTermFields 字串陣列欄位：可以 autocomplete、審核頁會檢查「新值」
var VideoTermFields = []string{"actresses", "directors", "series", "makers", "labels", "tags"}

// VideoTermSuggestRequest autocomplete 查詢：field 是 VideoTermFields 其中一個
type VideoTermSuggestRequest struct {
	Field string `query:"field"`
	Q     string `query:"q"`
}
