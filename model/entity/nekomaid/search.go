package nekomaid

type ArtworkSearchResult struct {
	ArtworkId string `json:"artwork_id"`
	AuthorId  any    `json:"author_id"`
	From      string `json:"from"`
	Gif       int    `json:"gif"`
	Photos    []struct {
		Height float64 `json:"height"`
		Ratio  float64 `json:"ratio"`
		Url    string  `json:"url"`
		Width  float64 `json:"width"`
	} `json:"photos"`
	PhotosCnt     int  `json:"photos_cnt"`
	PublishedDt   int  `json:"published_dt"`
	R18           bool `json:"r18"`
	TagCompletion []struct {
		Input string `json:"input"`
	} `json:"tag_completion"`
	Tags  []string `json:"tags"`
	Thumb string   `json:"thumb"`
	Title string   `json:"title"`
	Type  string   `json:"type"`
}

type ArtworkSearchClearRow struct {
	ArtworkId string `json:"artwork_id"`
	AuthorId  string `json:"author_id"`
	From      string `json:"from"`
	Gif       bool   `json:"gif"`
	Photos    []struct {
		Height float64 `json:"height"`
		Ratio  float64 `json:"ratio"`
		Url    string  `json:"url"`
		Width  float64 `json:"width"`
	} `json:"photos"`
	PhotosCnt    int      `json:"photos_cnt"`
	PublishedDt  int      `json:"published_dt"`
	Tags         []string `json:"tags"`
	Thumb        string   `json:"thumb"`
	Title        string   `json:"title"`
	Type         string   `json:"type"`
	NekomaidLink string   `json:"nekomaid_link"`
}
