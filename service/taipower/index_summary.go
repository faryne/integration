package taipower

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"

	"faryne.dev/model/enum"
	taipowerRepo "faryne.dev/repository/taipower"
	"faryne.dev/service/client"
)

type neighborIndexSummaryResponse struct {
	Hits struct {
		Total struct {
			Value int64 `json:"value"`
		} `json:"total"`
		Hits []struct {
			Source struct {
				ObjYear  int `json:"obj_year"`
				ObjMonth int `json:"obj_month"`
			} `json:"_source"`
		} `json:"hits"`
	} `json:"hits"`
	Aggregations struct {
		TotalCash struct {
			Value float64 `json:"value"`
		} `json:"total_cash"`
		CurrentRules struct {
			DocCount int64 `json:"doc_count"`
		} `json:"current_rules"`
	} `json:"aggregations"`
}

// neighborIndexSummary 取得索引的總筆數、總額及最新月份供資料守恆檢查。
func neighborIndexSummary(ctx context.Context) (taipowerRepo.NeighborSummary, error) {
	query := map[string]any{
		"size": 1, "track_total_hits": true, "_source": []string{"obj_year", "obj_month"},
		"sort": []map[string]string{{"obj_year": "desc"}, {"obj_month": "desc"}},
		"aggs": map[string]any{
			"total_cash": map[string]any{"sum": map[string]any{"field": "cash"}},
			"current_rules": map[string]any{"filter": map[string]any{"bool": map[string]any{"must": []map[string]any{
				{"term": map[string]any{"normalization_version": neighborNormalizationVersion}},
				{"term": map[string]any{"purpose_rule_version": neighborPurposeRuleVersion}},
			}}}},
		},
	}
	var body bytes.Buffer
	if err := json.NewEncoder(&body).Encode(query); err != nil {
		return taipowerRepo.NeighborSummary{}, err
	}
	es := client.GetElasticSearch(enum.ESDefault)
	if es == nil {
		return taipowerRepo.NeighborSummary{}, fmt.Errorf("elasticsearch client is not initialized")
	}
	response, err := es.Search(es.Search.WithContext(ctx), es.Search.WithIndex(neighborIndexName), es.Search.WithBody(&body))
	if err != nil {
		return taipowerRepo.NeighborSummary{}, err
	}
	defer response.Body.Close()
	content, err := io.ReadAll(response.Body)
	if err != nil {
		return taipowerRepo.NeighborSummary{}, err
	}
	if response.StatusCode < http.StatusOK || response.StatusCode >= http.StatusMultipleChoices {
		return taipowerRepo.NeighborSummary{}, fmt.Errorf("search neighbor summary: status=%s body=%s", response.Status(), content)
	}
	var result neighborIndexSummaryResponse
	if err := json.Unmarshal(content, &result); err != nil {
		return taipowerRepo.NeighborSummary{}, err
	}
	summary := taipowerRepo.NeighborSummary{Count: result.Hits.Total.Value, TotalCash: result.Aggregations.TotalCash.Value, VersionedCount: result.Aggregations.CurrentRules.DocCount}
	if len(result.Hits.Hits) > 0 {
		hit := result.Hits.Hits[0].Source
		summary.LatestMonth = hit.ObjYear*100 + hit.ObjMonth
	}
	return summary, nil
}
