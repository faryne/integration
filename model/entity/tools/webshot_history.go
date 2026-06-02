package tools

import "time"

type WebshotHistory struct {
	Id             int64     `json:"id" gorm:"primary_key"`
	MainId         int64     `json:"main_id"`
	FullImagePath  string    `json:"full_image_path"`
	ThumbImagePath string    `json:"thumb_image_path"`
	CreatedAt      time.Time `json:"created_at"`
}

func (WebshotHistory) TableName() string {
	return "webshot_history"
}
