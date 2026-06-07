package search

import (
	"bytes"
	"context"
	"encoding/json"
	"faryne.dev/model/entity"
	"faryne.dev/model/enum"
	"faryne.dev/service/client"
	"fmt"
	"io"
	"time"
)

func SetQuery(q map[string]any, mustOrShould bool, conditions map[string]any) {
	// 確保 conditions["query"] 被初始化為 map[string]any
	if _, ok := conditions["query"]; !ok {
		conditions["query"] = map[string]any{}
	}

	// 確保 conditions["query"]["bool"] 被初始化為 map[string]any
	queryMap := conditions["query"].(map[string]any)
	if _, ok := queryMap["bool"]; !ok {
		queryMap["bool"] = map[string]any{}
	}

	boolMap := queryMap["bool"].(map[string]any)
	if mustOrShould {
		if _, ok := boolMap["must"]; !ok {
			boolMap["must"] = make([]map[string]any, 0)
		}

		// 將新的條件添加到 must 陣列中
		mustSlice := boolMap["must"].([]map[string]any)
		boolMap["must"] = append(mustSlice, q)
	} else {
		if _, ok := boolMap["should"]; !ok {
			boolMap["should"] = make([]map[string]any, 0)
		}

		// 將新的條件添加到 must 陣列中
		shouldSlice := boolMap["should"].([]map[string]any)
		boolMap["should"] = append(shouldSlice, q)
	}
}

func SetSort(conditions map[string]any, field string, order string) {
	sortMap, ok := conditions["sort"].(map[string]any)
	if !ok {
		sortMap = map[string]any{}
		conditions["sort"] = sortMap
	}
	sortMap[field] = map[string]any{"order": order}
}

// Search performs a search query on an Elasticsearch index and returns the raw response, optional processed results, and an error.
// The index parameter specifies the Elasticsearch index to query.
// The query parameter is a map defining the search criteria.
// The cleanFunc parameter allows optional transformation of search results into a different format using a provided function.
// Returns the raw response as *entity.ElasticSearchResponse, a slice of processed results, and an error, if any.
func Search[T any, R any](index string, query map[string]any, cleanFunc ...func(input T) R) (*entity.ElasticSearchResponse[T], []R, error) {
	var r entity.ElasticSearchResponse[T]
	var o = make([]R, 0)
	c := client.GetElasticSearch(enum.ESDefault)
	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(query); err != nil {
		return nil, o, err
	}

	s, searchError := c.Search(
		c.Search.WithContext(context.Background()),
		c.Search.WithIndex(index),
		c.Search.WithBody(&buf),
		c.Search.WithPretty(),
		c.Search.WithTrackTotalHits(true),
	)
	if searchError != nil {
		return nil, o, searchError
	}
	defer s.Body.Close()

	d, _ := io.ReadAll(s.Body)

	if err := json.Unmarshal(d, &r); err != nil {
		return nil, o, err
	}

	if cleanFunc != nil && len(cleanFunc) > 0 && len(r.Hits.Hits) > 0 {
		for _, h := range r.Hits.Hits {
			o = append(o, cleanFunc[0](h.Source))
		}
	}
	return &r, o, nil
}

func Scroll[T any, R any](query map[string]any, scrollId string, cleanFunc ...func(input T) R) (*entity.ElasticSearchResponse[T], []R, error) {
	var r entity.ElasticSearchResponse[T]
	var o = make([]R, 0)
	c := client.GetElasticSearch(enum.ESDefault)
	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(query); err != nil {
		return nil, o, err
	}

	s, searchError := c.Scroll(
		c.Scroll.WithContext(context.Background()),
		c.Scroll.WithScroll(time.Hour),
		c.Scroll.WithScrollID(scrollId),
		c.Scroll.WithBody(&buf),
		c.Scroll.WithPretty(),
	)
	if searchError != nil {
		return nil, o, searchError
	}
	defer s.Body.Close()

	d, _ := io.ReadAll(s.Body)
	fmt.Printf("content: %s\n", string(d))

	if err := json.Unmarshal(d, &r); err != nil {
		return nil, o, err
	}

	if cleanFunc != nil && len(cleanFunc) > 0 && len(r.Hits.Hits) > 0 {
		for _, h := range r.Hits.Hits {
			o = append(o, cleanFunc[0](h.Source))
		}
	}
	return &r, o, nil
}
