package av

// 影片搜尋索引（ES／Manticore）共用的查詢與結果型別：引擎中立，不能出現 ES 的概念。
// 需要查 MySQL 才能決定的條件（女優頁的同名區分）由 service 先解析好再放進來，adapter 只負責翻成自己的查詢語法

// ActressAliasOpeners DMM 女優名字後面接這些字串，就是開始寫別名（「名字（別名…）」）
var ActressAliasOpeners = []string{"（", "(", " （", " ("}

// VideoIndexQuery 影片搜尋條件：VideoQueryRequest 加上已解析的女優條件。
// Actress 不為 nil 時以它為準，VideoQueryRequest 裡的 Actress／XCityID／ManualID／DMMID 不再參考
type VideoIndexQuery struct {
	VideoQueryRequest
	Actress *VideoActressFilter
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

// VideoStatsFilter 分組統計時的標籤條件，空字串代表不限
type VideoStatsFilter struct {
	Tag        string // 必須有這個標籤
	ExcludeTag string // 不能有這個標籤
}
