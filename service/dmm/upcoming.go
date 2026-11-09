package dmm

// 即將發售（joyu.fyi）：DMM 的預約作品。每日同步帶 excludeUndelivered: true 只抓已配信的；
// 這裡關掉它、查未來的配信日，就拿得到 releaseStatus = PRE_ORDER 的作品

// ReleaseStatusPreOrder 預約中（還沒配信）；由即將發售排程依配信日設定
const ReleaseStatusPreOrder = "PRE_ORDER"

// UpcomingItem 預約清單上的一部（清單沒有出演、發售商，要另外抓明細）
type UpcomingItem struct {
	No string
	// BookmarkCount DMM 上的收藏數：只拿來排序，不在畫面上顯示
	BookmarkCount int
}

// ListUpcoming 指定配信日（YYYY-MM-DD）某一頁的預約作品；hasNext 為 false 表示這天已經翻完
func (i *DMM) ListUpcoming(date string, page int) (items []UpcomingItem, hasNext bool, err error) {
	limit := 20
	variables := map[string]interface{}{
		"limit":                           limit,
		"offset":                          (page - 1) * limit,
		"sort":                            "RECOMMENDED",
		"facetLimit":                      1,
		"hasFacet":                        false,
		"hasGenreDescription":             false,
		"hasLegacyProductType":            false,
		"isLoggedIn":                      false,
		"excludeUndelivered":              false,
		"shouldFetchGenreRelatedWords":    false,
		"shouldFetchContentTagIds":        false,
		"shouldFetchDirectorRelatedWords": false,
		"shouldFetchLabelRelatedWords":    false,
		"shouldFetchSeriesRelatedWords":   false,
		"shouldFetchActressRelatedWords":  false,
		"shouldFetchMakerRelatedWords":    false,
		"shouldFetchHistrionRelatedWords": false,
		"isPhase4_2Released":              false,
		"filter":                          map[string]interface{}{"deliveryStartDate": date},
	}
	var res AvSearchResponse
	if err := i.send(dmmAVSearchGraphQL, variables, &res); err != nil {
		return nil, false, err
	}
	r := res.Data.LegacySearchPPV.Result
	for _, c := range r.Contents {
		items = append(items, UpcomingItem{No: c.Id, BookmarkCount: c.BookmarkCount})
	}
	return items, r.PageInfo.HasNext, nil
}
