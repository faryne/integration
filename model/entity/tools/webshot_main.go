package tools

import "time"

type WebshotMain struct {
	Id        int64     `json:"id" gorm:"primary_key"`
	Url       string    `json:"url"`
	UrlHash   string    `json:"url_hash"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

func (WebshotMain) TableName() string {
	return "webshot_main"
}
