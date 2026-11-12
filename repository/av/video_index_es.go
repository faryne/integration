package av

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"

	"faryne.dev/config"
	"faryne.dev/model/entity/opendata/av"
	"faryne.dev/model/enum"
	"faryne.dev/repository/search"
	"faryne.dev/service/client"
	esdsl "faryne.dev/service/search"
	"github.com/elastic/go-elasticsearch/v7"
)

// VideoIndex 的 ES 實作（索引名稱看 DMM_VIDEO_INDEX）。程式碼從 service/av 各檔案搬過來，查詢內容與行為不變

const (
	videoPageSize = 30
	// 篩選統計每組回傳的數量：標籤種類多所以多給一些
	facetTagSize   = 15
	facetOtherSize = 10
	// topicCompositePageSize composite aggregation 每頁的桶數；prod 一次要 9,000 個桶會回 503，分頁才穩
	topicCompositePageSize = 1000
	// videoDelistedQuery 全區間回補（2026-11-03 完成）後仍帶 logstash @timestamp 的文件：Go 同步會整筆覆寫、不寫 @timestamp，
	// 還留著就代表 DMM 每日清單已經撈不到（下架）。已標過 orphan 的排除，中斷後重跑會從還沒標的接著做
	videoDelistedQuery = `{"bool":{"filter":[{"exists":{"field":"@timestamp"}}],"must_not":[{"term":{"is_orphan":true}}]}}`
)

type videoIndexES struct{}

func videoIndexName() string {
	return config.EnvConfig().DMMVideoIndex
}

func esClient() (*elasticsearch.Client, error) {
	if es := client.GetElasticSearch(enum.ESDefault); es != nil {
		return es, nil
	}
	return nil, errors.New("elasticsearch client is not initialized")
}

func (videoIndexES) Search(_ context.Context, input av.VideoIndexQuery) (search.Page[av.RawVideo], error) {
	page := max(input.Page, 1)
	q := map[string]any{
		"size": videoPageSize,
		"from": (page - 1) * videoPageSize,
		"sort": videoSort(input.Sort),
	}
	applyVideoConditions(input, q)
	if input.Shuffle {
		randomizeQuery(q)
	}
	r, _, err := esdsl.Search[av.RawVideo, av.RawVideo](videoIndexName(), q)
	if err != nil {
		return search.Page[av.RawVideo]{}, err
	}
	out := search.Page[av.RawVideo]{Total: r.Hits.Total.Value, Hits: make([]search.Hit[av.RawVideo], 0, len(r.Hits.Hits))}
	for _, h := range r.Hits.Hits {
		out.Hits = append(out.Hits, search.Hit[av.RawVideo]{ID: h.Id, Source: h.Source})
	}
	return out, nil
}

// esBuckets terms aggregation 的結果
type esBuckets struct {
	Buckets []struct {
		Key      string `json:"key"`
		DocCount int    `json:"doc_count"`
	} `json:"buckets"`
}

func (b esBuckets) values() []av.VideoFacetBucket {
	out := make([]av.VideoFacetBucket, 0, len(b.Buckets))
	for _, x := range b.Buckets {
		out = append(out, av.VideoFacetBucket{Value: x.Key, Count: x.DocCount})
	}
	return out
}

func (videoIndexES) Facets(ctx context.Context, input av.VideoIndexQuery) (av.VideoFacets, error) {
	q := map[string]any{
		"size": 0,
		"aggs": map[string]any{
			"tags":      esdsl.TermsAgg("tags.keyword", facetTagSize),
			"makers":    esdsl.TermsAgg("makers.keyword", facetOtherSize),
			"series":    esdsl.TermsAgg("series.keyword", facetOtherSize),
			"actresses": esdsl.TermsAgg("actresses.keyword", facetOtherSize),
		},
	}
	applyVideoConditions(input, q)
	var res struct {
		Aggregations struct {
			Tags, Makers, Series, Actresses esBuckets
		} `json:"aggregations"`
	}
	if err := esdsl.Raw(ctx, videoIndexName(), q, &res); err != nil {
		return av.VideoFacets{}, err
	}
	a := res.Aggregations
	return av.VideoFacets{Tags: a.Tags.values(), Makers: a.Makers.values(), Series: a.Series.values(), Actresses: a.Actresses.values()}, nil
}

func (videoIndexES) TopActresses(ctx context.Context, input av.VideoIndexQuery, size int) ([]av.VideoFacetBucket, error) {
	q := map[string]any{"size": 0, "aggs": map[string]any{"actresses": esdsl.TermsAgg("actresses.keyword", size)}}
	applyVideoConditions(input, q)
	var res struct {
		Aggregations struct{ Actresses esBuckets } `json:"aggregations"`
	}
	if err := esdsl.Raw(ctx, videoIndexName(), q, &res); err != nil {
		return nil, err
	}
	return res.Aggregations.Actresses.values(), nil
}

// RecentByQueries 一個請求查完：每組條件是 filters 聚合裡的一個 filter，底下用 max 取最新配信日、top_hits 取最新幾部，
// 追蹤再多也只打一次 ES
func (videoIndexES) RecentByQueries(ctx context.Context, queries []av.VideoIndexQuery, perQuery int, soonestFirst bool) ([]av.VideoRecent, error) {
	out := make([]av.VideoRecent, len(queries))
	if len(queries) == 0 {
		return out, nil
	}
	filters := make(map[string]any, len(queries))
	for i, q := range queries {
		filters[strconv.Itoa(i)] = videoConditionQuery(q)
	}
	body := map[string]any{
		"size": 0,
		"aggs": map[string]any{"recent": map[string]any{
			"filters": map[string]any{"filters": filters},
			"aggs": map[string]any{
				"last": esDateAggs()["last"],
				"top": map[string]any{"top_hits": map[string]any{
					"size": perQuery,
					"sort": []any{map[string]any{"vod_date": map[string]any{"order": map[bool]string{true: "asc", false: "desc"}[soonestFirst]}}},
				}},
			},
		}},
	}
	var res struct {
		Aggregations struct {
			Recent struct {
				Buckets map[string]struct {
					DocCount int       `json:"doc_count"`
					Last     esDateAgg `json:"last"`
					Top      struct {
						Hits struct {
							Hits []struct {
								Source av.RawVideo `json:"_source"`
							} `json:"hits"`
						} `json:"hits"`
					} `json:"top"`
				} `json:"buckets"`
			} `json:"recent"`
		} `json:"aggregations"`
	}
	if err := esdsl.Raw(ctx, videoIndexName(), body, &res); err != nil {
		return nil, err
	}
	for i := range queries {
		b := res.Aggregations.Recent.Buckets[strconv.Itoa(i)]
		r := av.VideoRecent{Count: b.DocCount, Last: b.Last.ValueAsString}
		for _, h := range b.Top.Hits.Hits {
			r.Videos = append(r.Videos, h.Source)
		}
		out[i] = r
	}
	return out, nil
}

// videoSort 搜尋排序：
//   - 預設新到舊、VideoSortOldest 舊到新（舊資料的配信日欄位有 pulish_date 錯字，沿用原本兩個欄位一起排）
//   - VideoSortSoonest 配信日近的在前，同一天依 DMM 收藏數（即將發售頁）
//   - VideoSortPopular 依 DMM 收藏數（首頁「下週發售」）
//
// bookmark_count 只有預約索引有，加 unmapped_type 才不會在影片索引上報錯
func videoSort(sort string) []any {
	bookmark := map[string]any{"bookmark_count": map[string]any{"order": "desc", "unmapped_type": "integer"}}
	switch sort {
	case av.VideoSortSoonest:
		return []any{map[string]any{"vod_date": map[string]any{"order": "asc"}}, bookmark}
	case av.VideoSortPopular:
		return []any{bookmark, map[string]any{"vod_date": map[string]any{"order": "asc"}}}
	}
	order := "desc"
	if sort == av.VideoSortOldest {
		order = "asc"
	}
	return []any{map[string]any{"pulish_date": map[string]any{"order": order}}, map[string]any{"vod_date": map[string]any{"order": order}}}
}

// CountByDate 符合條件的影片依配信日（yyyy-MM-dd）計數，日期由舊到新（即將發售頁的日期列）
func (videoIndexES) CountByDate(ctx context.Context, input av.VideoIndexQuery) ([]av.VideoDateCount, error) {
	q := map[string]any{"size": 0, "aggs": map[string]any{"days": map[string]any{"date_histogram": map[string]any{
		"field": "vod_date", "calendar_interval": "day", "format": "yyyy-MM-dd", "min_doc_count": 1,
	}}}}
	applyVideoConditions(input, q)
	var res struct {
		Aggregations struct {
			Days struct {
				Buckets []struct {
					Key      string `json:"key_as_string"`
					DocCount int    `json:"doc_count"`
				} `json:"buckets"`
			} `json:"days"`
		} `json:"aggregations"`
	}
	if err := esdsl.Raw(ctx, videoIndexName(), q, &res); err != nil {
		return nil, err
	}
	out := make([]av.VideoDateCount, 0, len(res.Aggregations.Days.Buckets))
	for _, b := range res.Aggregations.Days.Buckets {
		out = append(out, av.VideoDateCount{Date: b.Key, Count: b.DocCount})
	}
	return out, nil
}

// videoConditionQuery 把一組搜尋條件轉成單一個 ES query（給 filters 聚合用）；沒有任何條件時是 match_all
func videoConditionQuery(input av.VideoIndexQuery) map[string]any {
	q := map[string]any{}
	applyVideoConditions(input, q)
	if query, ok := q["query"].(map[string]any); ok {
		return query
	}
	return map[string]any{"match_all": map[string]any{}}
}

// esDateAgg min／max 聚合的結果；沒有影片時 value_as_string 不存在，維持空字串
type esDateAgg struct {
	ValueAsString string `json:"value_as_string"`
}

func esDateAggs() map[string]any {
	return map[string]any{
		"first": map[string]any{"min": map[string]any{"field": "vod_date", "format": "yyyy/MM/dd"}},
		"last":  map[string]any{"max": map[string]any{"field": "vod_date", "format": "yyyy/MM/dd"}},
	}
}

func (videoIndexES) DateStats(ctx context.Context, input av.VideoIndexQuery) (av.VideoStats, error) {
	q := map[string]any{"size": 0, "track_total_hits": true, "aggs": esDateAggs()}
	applyVideoConditions(input, q)
	var out struct {
		Hits struct {
			Total struct {
				Value int `json:"value"`
			} `json:"total"`
		} `json:"hits"`
		Aggregations struct {
			First, Last esDateAgg
		} `json:"aggregations"`
	}
	if err := esdsl.Raw(ctx, videoIndexName(), q, &out); err != nil {
		return av.VideoStats{}, err
	}
	return av.VideoStats{Count: out.Hits.Total.Value, First: out.Aggregations.First.ValueAsString, Last: out.Aggregations.Last.ValueAsString}, nil
}

// StatsByActress 以 actresses.keyword 跑 composite aggregation（分頁）
func (videoIndexES) StatsByActress(ctx context.Context, f av.VideoStatsFilter, withDates bool) ([]av.VideoActressStats, error) {
	// 只算已配信的（預約作品也在同一個索引）
	b := map[string]any{"filter": []any{releasedQuery()}}
	if f.Tag != "" {
		b["filter"] = append(b["filter"].([]any), map[string]any{"term": map[string]any{"tags.keyword": f.Tag}})
	}
	if f.ExcludeTag != "" {
		b["must_not"] = []any{map[string]any{"term": map[string]any{"tags.keyword": f.ExcludeTag}}}
	}
	if r := dateRange(f.From, f.To); r != nil {
		b["filter"] = append(b["filter"].([]any), map[string]any{"range": map[string]any{"vod_date": r}})
	}
	filter := map[string]any{"bool": b}
	var out []av.VideoActressStats
	var after map[string]any
	for {
		composite := map[string]any{"size": topicCompositePageSize, "sources": []any{map[string]any{"name": map[string]any{"terms": map[string]any{"field": "actresses.keyword"}}}}}
		if after != nil {
			composite["after"] = after
		}
		agg := map[string]any{"composite": composite}
		if withDates {
			agg["aggs"] = esDateAggs()
		}
		body := map[string]any{"size": 0, "query": filter, "aggs": map[string]any{"a": agg}}
		var res struct {
			Aggregations struct {
				A struct {
					AfterKey map[string]any `json:"after_key"`
					Buckets  []struct {
						Key         struct{ Name string } `json:"key"`
						DocCount    int                   `json:"doc_count"`
						First, Last esDateAgg
					} `json:"buckets"`
				} `json:"a"`
			} `json:"aggregations"`
		}
		if err := esdsl.Raw(ctx, videoIndexName(), body, &res); err != nil {
			return nil, err
		}
		for _, b := range res.Aggregations.A.Buckets {
			out = append(out, av.VideoActressStats{Name: b.Key.Name, VideoStats: av.VideoStats{Count: b.DocCount, First: b.First.ValueAsString, Last: b.Last.ValueAsString}})
		}
		if len(res.Aggregations.A.Buckets) < topicCompositePageSize || res.Aggregations.A.AfterKey == nil {
			return out, nil
		}
		after = res.Aggregations.A.AfterKey
	}
}

// dateRange 配信日區間的 range 條件（From 含、To 不含），兩個都空就回 nil
func dateRange(from, to string) map[string]any {
	r := map[string]any{}
	if from != "" {
		r["gte"] = from
	}
	if to != "" {
		r["lt"] = to
	}
	if len(r) == 0 {
		return nil
	}
	return r
}

// Terms 只有一個子字串時先用 wildcard 縮小到有這個字的影片，再對這些影片做 terms aggregation
// （include 再過濾一次，因為同一部影片的其他值不一定包含這個字）
func (videoIndexES) Terms(ctx context.Context, field string, size int, contains ...string) ([]av.VideoFacetBucket, error) {
	key := field + ".keyword"
	agg := esdsl.TermsAgg(key, size)
	body := map[string]any{"size": 0, "aggs": map[string]any{"values": agg}}
	if len(contains) > 0 {
		parts := make([]string, 0, len(contains))
		for _, c := range contains {
			parts = append(parts, esdsl.RegexpEscaper.Replace(c))
		}
		agg["terms"].(map[string]any)["include"] = ".*(" + strings.Join(parts, "|") + ").*"
	}
	if len(contains) == 1 {
		body["query"] = map[string]any{"wildcard": map[string]any{key: map[string]any{"value": "*" + esdsl.WildcardEscaper.Replace(contains[0]) + "*"}}}
	}
	var res struct {
		Aggregations struct {
			Values esBuckets `json:"values"`
		} `json:"aggregations"`
	}
	if err := esdsl.Raw(ctx, videoIndexName(), body, &res); err != nil {
		return nil, err
	}
	return res.Aggregations.Values.values(), nil
}

func (videoIndexES) ExistingTerms(ctx context.Context, field string, values []string) (map[string]bool, error) {
	key := field + ".keyword"
	// include 給陣列時是完全相符，不是 regexp，值裡的特殊字元不用跳脫
	body := map[string]any{
		"size":  0,
		"query": map[string]any{"terms": map[string]any{key: values}},
		"aggs":  map[string]any{"values": map[string]any{"terms": map[string]any{"field": key, "include": values, "size": len(values)}}},
	}
	var res struct {
		Aggregations struct {
			Values esBuckets `json:"values"`
		} `json:"aggregations"`
	}
	if err := esdsl.Raw(ctx, videoIndexName(), body, &res); err != nil {
		return nil, err
	}
	out := map[string]bool{}
	for _, b := range res.Aggregations.Values.Buckets {
		out[b.Key] = true
	}
	return out, nil
}

func (videoIndexES) Sources(ctx context.Context, vids []int) (map[int]map[string]any, error) {
	out := map[int]map[string]any{}
	if len(vids) == 0 {
		return out, nil
	}
	es, err := esClient()
	if err != nil {
		return nil, err
	}
	body, _ := json.Marshal(map[string]any{"ids": vidStrings(vids)})
	resp, err := es.Mget(bytes.NewReader(body), es.Mget.WithContext(ctx), es.Mget.WithIndex(videoIndexName()))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, err
	}
	if resp.IsError() {
		return nil, fmt.Errorf("mget dmm videos failed: status=%s body=%.300s", resp.Status(), raw)
	}
	var res struct {
		Docs []struct {
			ID     string         `json:"_id"`
			Found  bool           `json:"found"`
			Source map[string]any `json:"_source"`
		} `json:"docs"`
	}
	if err := json.Unmarshal(raw, &res); err != nil {
		return nil, err
	}
	for _, d := range res.Docs {
		if vid, err := strconv.Atoi(d.ID); err == nil && d.Found {
			out[vid] = d.Source
		}
	}
	return out, nil
}

// Index document id 固定是 vid（dmm.id，沿用 logstash 時代的規則），重複寫入就是整份覆蓋
func (videoIndexES) Index(ctx context.Context, vid int, doc any, waitVisible bool) error {
	es, err := esClient()
	if err != nil {
		return err
	}
	body, err := json.Marshal(doc)
	if err != nil {
		return err
	}
	// 單筆同步要馬上查得到才等 refresh；批次同步不等，避免拖慢
	refresh := "false"
	if waitVisible {
		refresh = "wait_for"
	}
	resp, err := es.Index(videoIndexName(), bytes.NewReader(body),
		es.Index.WithContext(ctx), es.Index.WithDocumentID(strconv.Itoa(vid)), es.Index.WithRefresh(refresh))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return fmt.Errorf("index dmm video failed: status=%s vid=%d", resp.Status(), vid)
	}
	return nil
}

// MarkOrphan 整批用 update_by_query 標 is_orphan；refresh 後下一批查詢才不會再撈到同一批。
// 實際更新筆數對不上就回錯，避免標不上時呼叫端無窮迴圈
func (videoIndexES) MarkOrphan(ctx context.Context, vids []int) error {
	if len(vids) == 0 {
		return nil
	}
	es, err := esClient()
	if err != nil {
		return err
	}
	values, _ := json.Marshal(vidStrings(vids))
	body := fmt.Sprintf(`{"query":{"ids":{"values":%s}},"script":{"source":"ctx._source.is_orphan = true","lang":"painless"}}`, values)
	resp, err := es.UpdateByQuery([]string{videoIndexName()},
		es.UpdateByQuery.WithContext(ctx),
		es.UpdateByQuery.WithBody(strings.NewReader(body)),
		es.UpdateByQuery.WithRefresh(true),
		es.UpdateByQuery.WithConflicts("proceed"),
	)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.IsError() {
		return fmt.Errorf("mark dmm videos orphan failed: %s", resp.Status())
	}
	// 版本衝突＝剛好被每日同步覆寫（已經是新資料），不用標，也算處理過
	var r struct {
		Updated   int `json:"updated"`
		Conflicts int `json:"version_conflicts"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&r); err != nil {
		return err
	}
	if r.Updated+r.Conflicts != len(vids) {
		return fmt.Errorf("mark dmm videos orphan updated %d of %d", r.Updated, len(vids))
	}
	return nil
}

func (videoIndexES) NextDelistedVids(ctx context.Context, size int) ([]int, error) {
	es, err := esClient()
	if err != nil {
		return nil, err
	}
	body := fmt.Sprintf(`{"size":%d,"_source":false,"query":%s}`, size, videoDelistedQuery)
	resp, err := es.Search(es.Search.WithContext(ctx), es.Search.WithIndex(videoIndexName()), es.Search.WithBody(strings.NewReader(body)))
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.IsError() {
		return nil, fmt.Errorf("search delisted videos failed: %s", resp.Status())
	}
	var r struct {
		Hits struct {
			Hits []struct {
				ID string `json:"_id"`
			} `json:"hits"`
		} `json:"hits"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&r); err != nil {
		return nil, err
	}
	ids := make([]int, 0, len(r.Hits.Hits))
	for _, h := range r.Hits.Hits {
		id, err := strconv.Atoi(h.ID)
		if err != nil {
			return nil, fmt.Errorf("unexpected dmm video document id %q", h.ID)
		}
		ids = append(ids, id)
	}
	return ids, nil
}

// vidStrings ES 的 document id 是字串
func vidStrings(vids []int) []string {
	out := make([]string, len(vids))
	for i, v := range vids {
		out[i] = strconv.Itoa(v)
	}
	return out
}
