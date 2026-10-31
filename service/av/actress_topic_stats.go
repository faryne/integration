package av

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"

	"faryne.dev/config"
	avEntity "faryne.dev/model/entity/opendata/av"
	"faryne.dev/model/enum"
	avRepo "faryne.dev/repository/av"
	"faryne.dev/service/client"
)

// topicCompositePageSize composite aggregation 每頁的桶數；prod 一次要 9,000 個桶會回 503，分頁才穩
const topicCompositePageSize = 1000

// loadActressTopicProfiles 從 MySQL 讀全部 xcity＋manual 女優（info 已套用過覆寫），算好星座，再補上出演統計
func loadActressTopicProfiles(ctx context.Context) ([]actressTopicProfile, error) {
	rows, err := avRepo.NewDMMActress().FindByDomains(actressSearchDomains)
	if err != nil {
		return nil, err
	}
	byName, err := actressStatsByName(ctx)
	if err != nil {
		return nil, fmt.Errorf("actress stats: %w", err)
	}
	nameCount := map[string]int{}
	for _, row := range rows {
		nameCount[row.Name]++
	}

	profiles := make([]actressTopicProfile, 0, len(rows))
	for _, row := range rows {
		f := actressRowFields(row)
		p := actressTopicProfile{Domain: row.Domain, AID: row.ID, Fields: f, Horoscope: horoscopeOf(f.BirthMonth, f.BirthDay), Stats: byName[row.Name]}
		// 同名女優照女優頁的規則（對照表裡的 DMM 女優 ID）逐位查，不然會把同名的人算在一起
		if nameCount[row.Name] > 1 {
			if p.Stats, err = actressStatsByRow(ctx, row); err != nil {
				return nil, fmt.Errorf("actress stats %s-%d: %w", row.Domain, row.ID, err)
			}
		}
		profiles = append(profiles, p)
	}
	return profiles, nil
}

// actressStatsByName 全部影片依出演者分組：部數、最早／最晚配信日（含總集編，跟女優頁一致）
func actressStatsByName(ctx context.Context) (map[string]actressVideoStats, error) {
	return compositeByActress(ctx, nil, true)
}

// actressStatsByRow 單一位女優的統計，條件跟女優頁（本名那一頁）的出演影片相同（actressVideoQuery）
func actressStatsByRow(ctx context.Context, row avEntity.DMMActress) (actressVideoStats, error) {
	query, err := actressVideoQuery(row, row.Name)
	if err != nil {
		return actressVideoStats{}, err
	}
	var out struct {
		Hits struct {
			Total struct {
				Value int `json:"value"`
			} `json:"total"`
		} `json:"hits"`
		Aggregations struct {
			First, Last topicDateAgg
		} `json:"aggregations"`
	}
	body := map[string]any{"size": 0, "track_total_hits": true, "query": query, "aggs": topicDateAggs()}
	if err := esVideoSearch(ctx, body, &out); err != nil {
		return actressVideoStats{}, err
	}
	return actressVideoStats{Count: out.Hits.Total.Value, First: out.Aggregations.First.ValueAsString, Last: out.Aggregations.Last.ValueAsString}, nil
}

// topicDateAgg min／max 聚合的結果；沒有影片時 value_as_string 不存在，維持空字串
type topicDateAgg struct {
	ValueAsString string `json:"value_as_string"`
}

func topicDateAggs() map[string]any {
	return map[string]any{
		"first": map[string]any{"min": map[string]any{"field": "vod_date", "format": "yyyy/MM/dd"}},
		"last":  map[string]any{"max": map[string]any{"field": "vod_date", "format": "yyyy/MM/dd"}},
	}
}

// compositeByActress 以 actresses.keyword 分組跑 composite aggregation（分頁），名字用 actressBaseName 去掉別名後合併。
// filter 為 nil 時看全部影片；withDates 才另外取最早／最晚配信日（類型統計只要部數）
func compositeByActress(ctx context.Context, filter map[string]any, withDates bool) (map[string]actressVideoStats, error) {
	out := map[string]actressVideoStats{}
	var after map[string]any
	for {
		composite := map[string]any{"size": topicCompositePageSize, "sources": []any{map[string]any{"name": map[string]any{"terms": map[string]any{"field": "actresses.keyword"}}}}}
		if after != nil {
			composite["after"] = after
		}
		agg := map[string]any{"composite": composite}
		if withDates {
			agg["aggs"] = topicDateAggs()
		}
		body := map[string]any{"size": 0, "aggs": map[string]any{"a": agg}}
		if filter != nil {
			body["query"] = filter
		}
		var res struct {
			Aggregations struct {
				A struct {
					AfterKey map[string]any `json:"after_key"`
					Buckets  []struct {
						Key         struct{ Name string } `json:"key"`
						DocCount    int                   `json:"doc_count"`
						First, Last topicDateAgg
					} `json:"buckets"`
				} `json:"a"`
			} `json:"aggregations"`
		}
		if err := esVideoSearch(ctx, body, &res); err != nil {
			return nil, err
		}
		for _, b := range res.Aggregations.A.Buckets {
			name := actressBaseName(b.Key.Name)
			if name == "" {
				continue
			}
			s := out[name]
			s.Count += b.DocCount
			s.First = minDate(s.First, b.First.ValueAsString)
			s.Last = max(s.Last, b.Last.ValueAsString)
			out[name] = s
		}
		if len(res.Aggregations.A.Buckets) < topicCompositePageSize || res.Aggregations.A.AfterKey == nil {
			return out, nil
		}
		after = res.Aggregations.A.AfterKey
	}
}

// minDate 取較早的日期，空字串視為沒有資料（vod_date 格式可以直接比字串）
func minDate(a, b string) string {
	if a == "" || (b != "" && b < a) {
		return b
	}
	return a
}

// esVideoSearch 對 dmmvideos 送一個查詢，整包回應解到 out
func esVideoSearch(ctx context.Context, body map[string]any, out any) error {
	es := client.GetElasticSearch(enum.ESDefault)
	if es == nil {
		return fmt.Errorf("elasticsearch client is not initialized")
	}
	buf, err := json.Marshal(body)
	if err != nil {
		return err
	}
	resp, err := es.Search(es.Search.WithContext(ctx), es.Search.WithIndex(config.EnvConfig().DMMVideoIndex), es.Search.WithBody(bytes.NewReader(buf)))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	raw, err := io.ReadAll(resp.Body)
	if err != nil {
		return err
	}
	if resp.IsError() {
		return fmt.Errorf("search dmmvideos failed: status=%s body=%.300s", resp.Status(), raw)
	}
	return json.Unmarshal(raw, out)
}
