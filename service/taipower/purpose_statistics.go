package taipower

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"sort"
	"time"

	taipowerModel "faryne.dev/model/entity/opendata/taipower"
	"faryne.dev/model/enum"
	"faryne.dev/service/client"
)

type purposeStatisticResponse struct {
	Aggregations struct {
		Grouped struct {
			AfterKey map[string]any `json:"after_key"`
			Buckets  []struct {
				Key struct {
					Year     int    `json:"year"`
					CityArea string `json:"cityarea"`
					Purpose  string `json:"purpose"`
				} `json:"key"`
				DocCount  int64 `json:"doc_count"`
				TotalCash struct {
					Value float64 `json:"value"`
				} `json:"total_cash"`
			} `json:"buckets"`
		} `json:"grouped"`
	} `json:"aggregations"`
}

// NeighborPurposeStatistics 依年度、標準行政區及單一主用途聚合，保留未分類桶。
func NeighborPurposeStatistics() (*taipowerModel.NeighborPurposeStatisticsOutput, error) {
	rows := make([]taipowerModel.NeighborPurposeStatistic, 0)
	var after map[string]any
	for {
		page, err := fetchPurposeStatisticPage(after)
		if err != nil {
			return nil, err
		}
		for _, bucket := range page.Aggregations.Grouped.Buckets {
			rows = append(rows, taipowerModel.NeighborPurposeStatistic{
				Year: bucket.Key.Year, CityArea: bucket.Key.CityArea, Purpose: bucket.Key.Purpose,
				Count: bucket.DocCount, TotalCash: bucket.TotalCash.Value,
			})
		}
		if len(page.Aggregations.Grouped.AfterKey) == 0 || len(page.Aggregations.Grouped.Buckets) < statisticCompositeSize {
			break
		}
		after = page.Aggregations.Grouped.AfterKey
	}
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].Year != rows[j].Year {
			return rows[i].Year > rows[j].Year
		}
		if rows[i].CityArea != rows[j].CityArea {
			return rows[i].CityArea < rows[j].CityArea
		}
		return rows[i].Purpose < rows[j].Purpose
	})
	return &taipowerModel.NeighborPurposeStatisticsOutput{GeneratedAt: time.Now(), Data: rows}, nil
}

func fetchPurposeStatisticPage(after map[string]any) (*purposeStatisticResponse, error) {
	composite := map[string]any{
		"size": statisticCompositeSize,
		"sources": []map[string]any{
			{"year": map[string]any{"terms": map[string]any{"field": "obj_year"}}},
			{"cityarea": map[string]any{"terms": map[string]any{"field": "cityarea_key"}}},
			{"purpose": map[string]any{"terms": map[string]any{"field": "purpose_key"}}},
		},
	}
	if len(after) > 0 {
		composite["after"] = after
	}
	query := map[string]any{"size": 0, "aggs": map[string]any{"grouped": map[string]any{
		"composite": composite,
		"aggs":      map[string]any{"total_cash": map[string]any{"sum": map[string]any{"field": "cash"}}},
	}}}
	var body bytes.Buffer
	if err := json.NewEncoder(&body).Encode(query); err != nil {
		return nil, err
	}
	es := client.GetElasticSearch(enum.ESDefault)
	if es == nil {
		return nil, fmt.Errorf("elasticsearch client is not initialized")
	}
	response, err := es.Search(es.Search.WithContext(context.Background()), es.Search.WithIndex(neighborIndexName), es.Search.WithBody(&body))
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()
	content, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, err
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("search purpose statistics failed: status=%s body=%s", response.Status(), content)
	}
	var result purposeStatisticResponse
	if err := json.Unmarshal(content, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
