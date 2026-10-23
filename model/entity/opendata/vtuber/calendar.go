package vtuber

import "time"

// CalendarKeyAll hololive 總表在 vtuber_calendars 的 calendar_key；個人行事曆的 key 是 YouTube channel ID
const CalendarKeyAll = "all"

// Calendar 對應 vtuber_calendars：公開 Google 行事曆
type Calendar struct {
	CalendarKey string    `gorm:"column:calendar_key"`
	CalendarID  string    `gorm:"column:calendar_id"`
	CreatedAt   time.Time `gorm:"column:created_at"`
	UpdatedAt   time.Time `gorm:"column:updated_at"`
}

func (Calendar) TableName() string {
	return "vtuber_calendars"
}
