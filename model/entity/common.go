package entity

type CommonOutput[T any] struct {
	Data         T      `json:"data"`
	CurrentPage  int64  `json:"current_page"`
	FirstPageUrl string `json:"first_page_url"`
	From         int64  `json:"from"`
	LastPage     int64  `json:"last_page"`
	LastPageUrl  string `json:"last_page_url"`
	NextPageUrl  string `json:"next_page_url"`
	Path         string `json:"path"`
	PerPage      int64  `json:"per_page"`
	PrevPageUrl  string `json:"prev_page_url"`
	To           int64  `json:"to"`
	Total        int64  `json:"total"`
}
