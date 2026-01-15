package search

import (
	"bytes"
	"context"
	"encoding/json"
	"faryne.dev/model/enum"
	"faryne.dev/service/client"
)

func Search[T any, R any](index string, query map[string]any, cleanFunc ...func(input T) R) (*ElasticSearchResponse[T], []R, error) {
	var r ElasticSearchResponse[T]
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

	if err := json.NewDecoder(s.Body).Decode(&r); err != nil {
		return nil, o, err
	}

	if cleanFunc != nil && len(cleanFunc) > 0 && len(r.Hits.Hits) > 0 {
		for _, h := range r.Hits.Hits {
			o = append(o, cleanFunc[0](h.Source))
		}
	}
	return &r, o, nil
}
