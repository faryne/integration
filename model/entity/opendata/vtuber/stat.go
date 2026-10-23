package vtuber

import "time"

// Stat 對應 vtuber_stats：每個頻道每天一筆。
// RecordDate 存 YYYY-MM-DD（Asia/Taipei）字串，避免 DSN 時區設定把台灣午夜轉成前一天。
type Stat struct {
	ChannelID       string    `gorm:"column:channel_id" json:"-"`
	RecordDate      string    `gorm:"column:record_date" json:"record_date"`
	SubscriberCount uint64    `gorm:"column:subscriber_count" json:"subscriber_count"`
	ViewCount       uint64    `gorm:"column:view_count" json:"view_count"`
	VideoCount      uint64    `gorm:"column:video_count" json:"video_count"`
	CreatedAt       time.Time `gorm:"column:created_at" json:"-"`
	UpdatedAt       time.Time `gorm:"column:updated_at" json:"-"`
}

func (Stat) TableName() string {
	return "vtuber_stats"
}
