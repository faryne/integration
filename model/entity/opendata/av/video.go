package av

import "time"

type RawVideo struct {
	Version string `json:"@version"`
	Url     string `json:"url"`
	Type    string `json:"type"`
	No      string `json:"no"`
	VodDate string `json:"vod_date"`
	Images  []struct {
		Preview string `json:"preview"`
		Thumb   string `json:"thumb"`
	} `json:"images"`
	Thumb       string        `json:"thumb"`
	Title       string        `json:"title"`
	Labels      []string      `json:"labels"`
	Makers      []string      `json:"makers"`
	Vid         int           `json:"vid"`
	PublishDate interface{}   `json:"publish_date"`
	Tags        []string      `json:"tags"`
	Duration    int           `json:"duration"`
	Directors   []interface{} `json:"directors"`
	Series      []interface{} `json:"series"`
	Actresses   []string      `json:"actresses"`
	Timestamp   time.Time     `json:"@timestamp"`
}

type CleanVideo struct {
	Url     string `json:"url"`
	No      string `json:"no"`
	VodDate string `json:"vod_date"`
	Images  []struct {
		Preview string `json:"preview"`
		Thumb   string `json:"thumb"`
	} `json:"images"`
	Thumb       string        `json:"thumb"`
	Title       string        `json:"title"`
	Labels      []string      `json:"labels"`
	Makers      []string      `json:"makers"`
	PublishDate string        `json:"publish_date,omitempty"`
	Tags        []string      `json:"tags"`
	Duration    int           `json:"duration"`
	Directors   []interface{} `json:"directors"`
	Series      []interface{} `json:"series"`
	Actresses   []string      `json:"actresses"`
}
