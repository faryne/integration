package nccc

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"strings"

	"faryne.dev/model/entity"
	ncccModel "faryne.dev/model/entity/opendata/nccc"
	"faryne.dev/model/enum"
	"faryne.dev/service/client"
	"faryne.dev/service/helper"
)

const maxRecordPerPage = 100

var yearMonthFilterPattern = regexp.MustCompile(`^[0-9]{2,4}年[0-9]{1,2}月$`)

func ListIndexes() []ncccModel.IndexInfo {
	keys := dataSetKeys()
	indexes := make([]ncccModel.IndexInfo, 0, len(keys))
	for _, key := range keys {
		indexes = append(indexes, ncccModel.IndexInfo{
			Token: indexToken(key),
			Text:  dataSets[key].Text,
		})
	}
	return indexes
}

func ResolveIndexToken(token string) (string, ncccModel.IndexInfo, bool) {
	token = strings.TrimSpace(token)
	for key, dataSet := range dataSets {
		if hmac.Equal([]byte(indexToken(key)), []byte(token)) {
			return key, ncccModel.IndexInfo{
				Token: token,
				Text:  dataSet.Text,
			}, true
		}
	}
	return "", ncccModel.IndexInfo{}, false
}

func SearchRecords(input ncccModel.RecordSearchRequest, dataSetKey string) (*entity.ElasticSearchResponse[map[string]any], []map[string]any, error) {
	query, err := buildRecordSearchQuery(input)
	if err != nil {
		return nil, nil, err
	}
	return searchRecords(ncccIndexName(dataSetKey), query)
}

func EffectiveRecordPerPage(input ncccModel.RecordSearchRequest) int64 {
	perPage := input.PerPageValue(30)
	if perPage > maxRecordPerPage {
		return maxRecordPerPage
	}
	return perPage
}

func buildRecordSearchQuery(input ncccModel.RecordSearchRequest) (map[string]any, error) {
	perPage := EffectiveRecordPerPage(input)
	query := map[string]any{
		"size": perPage,
		"aggs": map[string]any{
			"regions": map[string]any{
				"terms": map[string]any{
					"field": "地區.keyword",
					"size":  100,
				},
			},
			"categories": map[string]any{
				"terms": map[string]any{
					"field": "類別.keyword",
					"size":  100,
				},
			},
		},
		"sort": []map[string]any{
			{"_doc": map[string]any{"order": "asc"}},
		},
	}
	if err := applyRecordFilters(query, input); err != nil {
		return nil, err
	}
	if strings.TrimSpace(input.Cursor) == "" {
		page := input.PageValue()
		if page*perPage > 10000 {
			return nil, fmt.Errorf("page is too deep; use cursor pagination")
		}
		query["from"] = (page - 1) * perPage
		return query, nil
	}
	cursor, err := helper.DecodeESCursor(input.Cursor)
	if err != nil {
		return nil, fmt.Errorf("cursor is invalid")
	}
	if cursor != nil {
		query["search_after"] = cursor.SearchAfter
	}
	return query, nil
}

func applyRecordFilters(query map[string]any, input ncccModel.RecordSearchRequest) error {
	must := make([]map[string]any, 0)
	yearMonths, err := parseYearMonthFilters(input.YearMonths)
	if err != nil {
		return err
	}
	if len(yearMonths) > 0 {
		must = append(must, map[string]any{
			"terms": map[string]any{"年月.keyword": yearMonths},
		})
	}
	if region := strings.TrimSpace(input.Region); region != "" {
		must = append(must, map[string]any{
			"term": map[string]any{"地區.keyword": region},
		})
	}
	if category := strings.TrimSpace(input.Category); category != "" {
		must = append(must, map[string]any{
			"term": map[string]any{"類別.keyword": category},
		})
	}
	if len(must) > 0 {
		query["query"] = map[string]any{
			"bool": map[string]any{"must": must},
		}
	}
	return nil
}

func parseYearMonthFilters(value string) ([]string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil, nil
	}
	seen := make(map[string]struct{})
	out := make([]string, 0)
	for _, part := range strings.Split(value, ",") {
		item := strings.TrimSpace(part)
		if item == "" {
			continue
		}
		if !yearMonthFilterPattern.MatchString(item) {
			return nil, fmt.Errorf("yearMonths must use NCCC format, e.g. 113年01月")
		}
		if _, ok := seen[item]; ok {
			continue
		}
		seen[item] = struct{}{}
		out = append(out, item)
	}
	return out, nil
}

func RecordFacets(raw *entity.ElasticSearchResponse[map[string]any]) ncccModel.RecordFacets {
	if raw == nil {
		return ncccModel.RecordFacets{}
	}
	return ncccModel.RecordFacets{
		Regions:    facetOptions(raw, "regions"),
		Categories: facetOptions(raw, "categories"),
	}
}

func facetOptions(raw *entity.ElasticSearchResponse[map[string]any], key string) []ncccModel.FacetOption {
	aggregation, ok := raw.Aggregations[key]
	if !ok {
		return nil
	}
	options := make([]ncccModel.FacetOption, 0, len(aggregation.Buckets))
	for _, bucket := range aggregation.Buckets {
		if bucket.Key == "" {
			continue
		}
		options = append(options, ncccModel.FacetOption{
			Value: bucket.Key,
			Count: bucket.DocCount,
		})
	}
	return options
}

func searchRecords(indexName string, query map[string]any) (*entity.ElasticSearchResponse[map[string]any], []map[string]any, error) {
	var result entity.ElasticSearchResponse[map[string]any]
	rows := make([]map[string]any, 0)
	es := client.GetElasticSearch(enum.ESDefault)
	if es == nil {
		return nil, rows, fmt.Errorf("elasticsearch client is not initialized")
	}

	var body bytes.Buffer
	if err := json.NewEncoder(&body).Encode(query); err != nil {
		return nil, rows, err
	}
	resp, err := es.Search(
		es.Search.WithContext(context.Background()),
		es.Search.WithIndex(indexName),
		es.Search.WithBody(&body),
		es.Search.WithTrackTotalHits(true),
	)
	if err != nil {
		return nil, rows, err
	}
	defer resp.Body.Close()

	responseBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, rows, err
	}
	if resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices {
		return nil, rows, fmt.Errorf("search %s failed: status=%s body=%s", indexName, resp.Status(), responseBody)
	}
	if err := json.Unmarshal(responseBody, &result); err != nil {
		return nil, rows, err
	}
	for _, hit := range result.Hits.Hits {
		rows = append(rows, hit.Source)
	}
	return &result, rows, nil
}

func indexToken(dataSetKey string) string {
	hash := hmac.New(sha256.New, []byte(documentIDKey))
	hash.Write([]byte(dataSetKey))
	return hex.EncodeToString(hash.Sum(nil))[:24]
}
