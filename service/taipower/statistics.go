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

const (
	statisticCompositeSize = 1000
	statisticsObjectPrefix = "taipower/neighbor"
)

type neighborStatisticResponse struct {
	Aggregations struct {
		Grouped struct {
			AfterKey map[string]any `json:"after_key"`
			Buckets  []struct {
				Key struct {
					Name string `json:"name"`
					Year int    `json:"year"`
				} `json:"key"`
				TotalCash struct {
					Value float64 `json:"value"`
				} `json:"total_cash"`
			} `json:"buckets"`
		} `json:"grouped"`
	} `json:"aggregations"`
}

func NeighborStatistics(groupBy string) (*taipowerModel.NeighborStatisticsOutput, error) {
	if err := ValidateNeighborStatisticGroup(groupBy); err != nil {
		return nil, err
	}

	yearTotals := make(map[string]map[int]float64)
	queryNames := make(map[string]string)
	var after map[string]any
	for {
		response, err := fetchNeighborStatisticPage(groupBy, after)
		if err != nil {
			return nil, err
		}
		for _, bucket := range response.Aggregations.Grouped.Buckets {
			name := bucket.Key.Name
			if _, ok := yearTotals[name]; !ok {
				yearTotals[name] = make(map[int]float64)
				queryNames[name] = name
			}
			yearTotals[name][bucket.Key.Year] += bucket.TotalCash.Value
		}
		if len(response.Aggregations.Grouped.AfterKey) == 0 ||
			len(response.Aggregations.Grouped.Buckets) < statisticCompositeSize {
			break
		}
		after = response.Aggregations.Grouped.AfterKey
	}

	rows := make([]taipowerModel.NeighborStatistic, 0, len(yearTotals))
	for name, totals := range yearTotals {
		years := make([]taipowerModel.NeighborStatisticYear, 0, len(totals))
		totalCash := float64(0)
		for year, cash := range totals {
			totalCash += cash
			years = append(years, taipowerModel.NeighborStatisticYear{
				Year:      year,
				TotalCash: cash,
			})
		}
		sort.Slice(years, func(i, j int) bool {
			return years[i].Year > years[j].Year
		})
		rows = append(rows, taipowerModel.NeighborStatistic{
			Name:      name,
			QueryName: queryNames[name],
			TotalCash: totalCash,
			Years:     years,
		})
	}
	sort.Slice(rows, func(i, j int) bool {
		if rows[i].TotalCash == rows[j].TotalCash {
			return rows[i].Name < rows[j].Name
		}
		return rows[i].TotalCash > rows[j].TotalCash
	})
	for i := range rows {
		rows[i].Rank = i + 1
	}

	return &taipowerModel.NeighborStatisticsOutput{
		GroupBy:     groupBy,
		GeneratedAt: time.Now(),
		Data:        rows,
	}, nil
}

func ValidateNeighborStatisticGroup(groupBy string) error {
	if groupBy != "unit" && groupBy != "cityarea" {
		return fmt.Errorf("groupBy must be unit or cityarea")
	}
	return nil
}

func fetchNeighborStatisticPage(groupBy string, after map[string]any) (*neighborStatisticResponse, error) {
	sources := []map[string]any{
		{"name": map[string]any{"terms": map[string]any{"field": groupBy + "_key"}}},
	}
	sources = append(sources, map[string]any{
		"year": map[string]any{"terms": map[string]any{"field": "obj_year"}},
	})
	composite := map[string]any{
		"size":    statisticCompositeSize,
		"sources": sources,
	}
	if len(after) > 0 {
		composite["after"] = after
	}
	query := map[string]any{
		"size": 0,
		"aggs": map[string]any{
			"grouped": map[string]any{
				"composite": composite,
				"aggs": map[string]any{
					"total_cash": map[string]any{
						"sum": map[string]any{"field": "cash"},
					},
				},
			},
		},
	}

	var body bytes.Buffer
	if err := json.NewEncoder(&body).Encode(query); err != nil {
		return nil, err
	}
	es := client.GetElasticSearch(enum.ESDefault)
	if es == nil {
		return nil, fmt.Errorf("elasticsearch client is not initialized")
	}
	response, err := es.Search(
		es.Search.WithContext(context.Background()),
		es.Search.WithIndex(neighborIndexName),
		es.Search.WithBody(&body),
	)
	if err != nil {
		return nil, err
	}
	defer response.Body.Close()

	responseBody, err := io.ReadAll(response.Body)
	if err != nil {
		return nil, err
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return nil, fmt.Errorf("search statistics failed: status=%s body=%s", response.Status(), responseBody)
	}

	var result neighborStatisticResponse
	if err := json.Unmarshal(responseBody, &result); err != nil {
		return nil, err
	}
	return &result, nil
}
