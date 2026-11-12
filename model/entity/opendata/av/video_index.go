package av

// 影片搜尋索引（ES／Manticore）共用的查詢與結果型別：引擎中立，不能出現 ES 的概念。
// 需要查 MySQL 才能決定的條件（女優頁的同名區分）由 service 先解析好再放進來，adapter 只負責翻成自己的查詢語法

// ActressAliasOpeners DMM 女優名字後面接這些字串，就是開始寫別名（「名字（別名…）」）
var ActressAliasOpeners = []string{"（", "(", " （", " ("}

// VideoIndexQuery 影片搜尋條件：VideoQueryRequest 加上已解析的女優條件。
// 出演一律看 Actresses（每位一個條件、取交集），VideoQueryRequest 裡的 Actress／XCityID／ManualID／DMMID 不再參考
type VideoIndexQuery struct {
	VideoQueryRequest
	Actresses []VideoActressFilter
	// Upcoming 只查即將發售（配信日在明天以後的預約作品）；false 時只查已配信的。依番號查單部（No）時兩者都查得到
	Upcoming bool
	// ExcludeTags 有其中任一個標籤的不算（joyu 股市算部數時排除總集編）；不開放給 API 參數
	ExcludeTags []string
}

// VideoActressFilter 出演者條件：名字完全相符或「名字（別名…）」，再依 DMM 女優 ID 區分同名
//   - OwnIDs 有值：actress_ids 含其中之一，或是沒有 actress_ids 的舊影片
//   - 否則 ClaimedIDs 有值：排除 actress_ids 含其中之一的影片（同名其他女優的作品）
type VideoActressFilter struct {
	Name       string
	OwnIDs     []string
	ClaimedIDs []string
}

// VideoStats 一群影片的部數與最早／最晚配信日（vod_date，沒有影片時是空字串）
type VideoStats struct {
	Count       int
	First, Last string
}

// VideoRecent 一組條件的部數、最新配信日（yyyy/MM/dd）與最新幾部影片（joyu 我的追蹤頁）
type VideoRecent struct {
	Count  int
	Last   string
	Videos []RawVideo
}

// VideoActressStats 依出演者名字分組的統計；Name 是影片上的原始寫法（可能帶括號別名）
type VideoActressStats struct {
	Name string
	VideoStats
}

// VideoStatsFilter 分組統計時的條件，空字串代表不限
type VideoStatsFilter struct {
	Tag        string // 必須有這個標籤
	ExcludeTag string // 不能有這個標籤
	// From／To 配信日區間（yyyy/MM/dd），From 含、To 不含；joyu 股市算滾動年度出片數用
	From, To string
}

// VideoPreOrder 即將發售排程寫入、還沒被每日同步覆寫的一部（有 fetched_at）：判斷要不要重抓明細用
type VideoPreOrder struct {
	Vid       int    `json:"vid"`
	No        string `json:"no"`
	VodDate   string `json:"vod_date"`
	FetchedAt string `json:"fetched_at"`
	// Thumb 空字串表示 DMM 還沒放封面（排程每天重抓一次，放上了就會補上）
	Thumb string `json:"thumb"`
}

// VideoDateCount 某一天（yyyy-MM-dd）的影片部數
type VideoDateCount struct {
	Date  string `json:"date"`
	Count int    `json:"count"`
}
