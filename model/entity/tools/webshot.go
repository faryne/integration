package tools

import "time"

type WebshotMain struct {
	Id        int64     `json:"id" gorm:"primary_key"`
	Url       string    `json:"url"`
	UrlHash   string    `json:"url_hash"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

type WebshotHistory struct {
	Id             int64     `json:"id" gorm:"primary_key"`
	MainId         int64     `json:"main_id"`
	FullImagePath  string    `json:"full_image_path"`
	ThumbImagePath string    `json:"thumb_image_path"`
	CreatedAt      time.Time `json:"created_at"`
}
