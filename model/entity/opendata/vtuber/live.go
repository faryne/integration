package vtuber

import "time"

// 直播狀態
const (
	LiveStatusUpcoming  = "upcoming"
	LiveStatusLive      = "live"
	LiveStatusEnded     = "ended"
	LiveStatusCancelled = "cancelled" // 轉私人或刪除，YouTube 查不到
)

// Live 對應 vtuber_lives：只收有 liveStreamingDetails 的影片（直播與首播）
type Live struct {
	ID                uint       `gorm:"column:id;primaryKey"`
	VideoID           string     `gorm:"column:video_id"`
	ChannelID         string     `gorm:"column:channel_id"`
	Title             string     `gorm:"column:title"`
	Status            string     `gorm:"column:status"`
	ScheduledStartAt  *time.Time `gorm:"column:scheduled_start_at"`
	ActualStartAt     *time.Time `gorm:"column:actual_start_at"`
	ActualEndAt       *time.Time `gorm:"column:actual_end_at"`
	ConcurrentViewers *uint      `gorm:"column:concurrent_viewers"`
	ThumbnailURL      string     `gorm:"column:thumbnail_url"`
	CheckedAt         time.Time  `gorm:"column:checked_at"`
	CreatedAt         time.Time  `gorm:"column:created_at"`
	UpdatedAt         time.Time  `gorm:"column:updated_at"`
}

func (Live) TableName() string {
	return "vtuber_lives"
}

// StartAt 已開播用實際開始時間，否則用預定時間
func (l Live) StartAt() *time.Time {
	if l.ActualStartAt != nil {
		return l.ActualStartAt
	}
	return l.ScheduledStartAt
}
