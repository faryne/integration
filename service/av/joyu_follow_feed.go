package av

import (
	"context"
	"net/url"
	"slices"
	"sort"
	"strconv"
	"strings"
	"time"

	"faryne.dev/model/entity"
	avEntity "faryne.dev/model/entity/opendata/av"
	avRepo "faryne.dev/repository/av"
	"faryne.dev/service/search"
)

// joyu.fyi「我的追蹤」頁：每個追蹤是一組影片搜尋條件，查最近 N 天（日本時間，含今天）的新片。
// 有新片的追蹤依最新配信日排序，每個最多附 feedPerFollow 部；沒有新片的（含女優資料已被刪掉的）另外列出

const feedPerFollow = 6

// feedDays 可選的天數；其他值一律當 14 天
var feedDays = []int{7, 14, 30}

// JoyuFollowItem 一筆追蹤的顯示資料
type JoyuFollowItem struct {
	Kind  string `json:"kind"`
	Value string `json:"value"`
	// Label 顯示名稱：女優是名字、搜尋條件是「女優 × 品牌 × 標籤」，其他就是 value
	Label   string            `json:"label"`
	Actress *avEntity.Actress `json:"actress,omitempty"`
	// Missing 女優資料已經不在了（被刪掉或合併），只能取消追蹤
	Missing bool `json:"missing,omitempty"`
	// SearchQuery 影片搜尋頁的查詢字串（不含日期），「到搜尋頁看全部」用
	SearchQuery string `json:"search_query"`
}

type JoyuFeedSection struct {
	JoyuFollowItem
	Count  int                   `json:"count"`
	Last   string                `json:"last"`
	Videos []avEntity.CleanVideo `json:"videos"`
}

type JoyuFeed struct {
	Days int `json:"days"`
	// Since 這段期間的第一天（yyyy-MM-dd），「到搜尋頁看全部」帶成 start_date
	Since    string            `json:"since"`
	Sections []JoyuFeedSection `json:"sections"`
	Quiet    []JoyuFollowItem  `json:"quiet"`
}

func JoyuFollowFeed(ctx context.Context, uid string, days int) (*JoyuFeed, error) {
	if !slices.Contains(feedDays, days) {
		days = 14
	}
	now := time.Now().In(jst)
	today := time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, jst)
	since := today.AddDate(0, 0, 1-days)
	start, end := entity.OnlyDateFormat(since), entity.OnlyDateFormat(today.AddDate(0, 0, 1))
	out := &JoyuFeed{Days: days, Since: since.Format(time.DateOnly), Sections: []JoyuFeedSection{}, Quiet: []JoyuFollowItem{}}

	follows, err := avRepo.NewJoyuFollow().ListByUID(uid)
	if err != nil || len(follows) == 0 {
		return out, err
	}
	actresses, profiles, err := followActresses(follows)
	if err != nil {
		return nil, err
	}

	// 每個追蹤轉成一組搜尋條件；查不了的（女優資料不在、搜尋條件壞掉）直接放進 quiet
	var items []JoyuFollowItem
	var queries []avEntity.VideoIndexQuery
	for _, f := range follows {
		item, req, ok := followItem(f, actresses, profiles)
		if !ok {
			out.Quiet = append(out.Quiet, item)
			continue
		}
		req.StartDate, req.EndDate = &start, &end
		q, err := videoIndexQuery(req)
		if err != nil {
			return nil, err
		}
		items = append(items, item)
		queries = append(queries, q)
	}
	recent, err := avRepo.NewVideoIndex().RecentByQueries(ctx, queries, feedPerFollow)
	if err != nil {
		return nil, err
	}
	for i, r := range recent {
		if r.Count == 0 {
			out.Quiet = append(out.Quiet, items[i])
			continue
		}
		sec := JoyuFeedSection{JoyuFollowItem: items[i], Count: r.Count, Last: r.Last, Videos: make([]avEntity.CleanVideo, 0, len(r.Videos))}
		for _, v := range r.Videos {
			sec.Videos = append(sec.Videos, fVideo(v))
		}
		out.Sections = append(out.Sections, sec)
	}
	// 最新配信日新的在前；同一天維持追蹤的先後
	sort.SliceStable(out.Sections, func(i, j int) bool { return out.Sections[i].Last > out.Sections[j].Last })
	return out, nil
}

// followActresses 女優追蹤對到的 DB 資料（算出演條件用）與女優索引資料（照片），key 都是 domain:aid
func followActresses(follows []avEntity.JoyuFollow) (map[string]avEntity.DMMActress, map[string]avEntity.Actress, error) {
	var keys []avRepo.ActressKey
	for _, f := range follows {
		if f.Kind != avEntity.FollowKindActress {
			continue
		}
		if domain, aid, ok := parseActressFollow(f.Value); ok {
			keys = append(keys, avRepo.ActressKey{Domain: domain, ID: aid})
		}
	}
	rows := map[string]avEntity.DMMActress{}
	profiles := map[string]avEntity.Actress{}
	if len(keys) == 0 {
		return rows, profiles, nil
	}
	found, err := avRepo.NewDMMActress().FindByKeys(keys)
	if err != nil {
		return nil, nil, err
	}
	for _, r := range found {
		rows[r.Domain+":"+strconv.Itoa(r.ID)] = r
	}
	// 女優索引一次查回照片：每位一個 domain＋aid 的條件
	should := make([]map[string]any, 0, len(keys))
	for _, k := range keys {
		should = append(should, map[string]any{"bool": map[string]any{"must": []map[string]any{
			exactStringQuery("domain", k.Domain), {"term": map[string]any{"aid": k.ID}},
		}}})
	}
	q := map[string]any{"size": len(keys), "query": map[string]any{"bool": map[string]any{"should": should, "minimum_should_match": 1}}}
	_, list, err := search.Search[avEntity.Actress, avEntity.Actress](actressIndexName(), q, fActress)
	if err != nil {
		return nil, nil, err
	}
	for _, a := range list {
		profiles[a.Domain+":"+strconv.Itoa(a.AID)] = a
	}
	return rows, profiles, nil
}

// followItem 一筆追蹤的顯示資料與對應的影片搜尋條件；ok 為 false 表示查不了（女優資料不在、搜尋條件壞掉）
func followItem(f avEntity.JoyuFollow, actresses map[string]avEntity.DMMActress, profiles map[string]avEntity.Actress) (JoyuFollowItem, avEntity.VideoQueryRequest, bool) {
	item := JoyuFollowItem{Kind: f.Kind, Value: f.Value, Label: f.Value}
	var req avEntity.VideoQueryRequest
	switch f.Kind {
	case avEntity.FollowKindActress:
		row, found := actresses[f.Value]
		if !found {
			item.Missing, item.Label = true, ""
			return item, req, false
		}
		item.Label = row.Name
		if p, ok := profiles[f.Value]; ok {
			item.Actress = &p
		}
		req.Actress = row.Name
		params := url.Values{"actress": {row.Name}}
		if row.Domain == avEntity.ActressDomainManual {
			req.ManualID = row.ID
			params.Set("manual_id", strconv.Itoa(row.ID))
		} else {
			req.XCityID = row.ID
			params.Set("xcity_id", strconv.Itoa(row.ID))
		}
		item.SearchQuery = params.Encode()
	case avEntity.FollowKindSearch:
		params, err := url.ParseQuery(f.Value)
		if err != nil {
			return item, req, false
		}
		req = searchFollowRequest(params)
		item.Label, item.SearchQuery = searchFollowLabel(params), f.Value
	default:
		switch f.Kind {
		case avEntity.FollowKindMaker:
			req.Maker = f.Value
		case avEntity.FollowKindLabel:
			req.Label = f.Value
		case avEntity.FollowKindSeries:
			req.Series = f.Value
		case avEntity.FollowKindDirector:
			req.Director = f.Value
		case avEntity.FollowKindTag:
			req.Tag = []string{f.Value}
		default:
			return item, req, false
		}
		item.SearchQuery = url.Values{f.Kind: {f.Value}}.Encode()
	}
	return item, req, true
}

// searchFollowRequest 把存下來的搜尋條件轉回影片搜尋參數（女優用 ID 指定是哪一位，同名才分得開）
func searchFollowRequest(p url.Values) avEntity.VideoQueryRequest {
	atoi := func(k string) int { n, _ := strconv.Atoi(p.Get(k)); return n }
	return avEntity.VideoQueryRequest{
		Actress: p.Get("actress"), XCityID: atoi("xcity_id"), ManualID: atoi("manual_id"), DMMID: p.Get("dmm_id"),
		Maker: p.Get("maker"), Label: p.Get("label"), Series: p.Get("series"), Director: p.Get("director"), Tag: p["tag"],
	}
}

// searchFollowLabel 搜尋條件的顯示名稱：「星宮みお × MOODYZ DIVA × 痴女」
func searchFollowLabel(p url.Values) string {
	var parts []string
	for _, k := range []string{"actress", "maker", "label", "series", "director"} {
		if v := p.Get(k); v != "" {
			parts = append(parts, v)
		}
	}
	return strings.Join(append(parts, p["tag"]...), " × ")
}
