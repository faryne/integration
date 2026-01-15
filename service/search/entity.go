package search

type ElasticSearchResponse[T any] struct {
	Took     int64    `json:"took"`
	TimedOut bool     `json:"timed_out"`
	Shards   struct{} `json:"_shards"`
	Hits     struct {
		Total struct {
			Relation string `json:"relation"`
			Value    int64  `json:"value"`
		} `json:"total"`
		MaxScore float64 `json:"max_score"`
		Hits     []struct {
			Id     string  `json:"_id"`
			Index  string  `json:"_index"`
			Score  float64 `json:"_score"`
			Source T       `json:"_source"`
		} `json:"hits"`
	} `json:"hits"`
}
