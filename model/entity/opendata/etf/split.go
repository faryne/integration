package etf

import "time"

// SplitEventSource 分割紀錄來源：預告表直接給比率；歷史表只有前後價格，比率是反推的
type SplitEventSource string

const (
	SplitEventSourcePreview SplitEventSource = "preview"
	SplitEventSourceHistory SplitEventSource = "history"
)

// SplitEvent ETF 分割/反分割事件；JSON 欄位對齊前端 EtfDivideInfo（date / ratio）
type SplitEvent struct {
	Id            int64            `json:"-" gorm:"column:id;primaryKey;autoIncrement"`
	Code          string           `json:"-" gorm:"column:code"`
	EffectiveDate string           `json:"date" gorm:"column:effective_date"` // 恢復買賣日 YYYY-MM-DD
	Ratio         float64          `json:"ratio" gorm:"column:ratio"`         // 分割後單位數 / 分割前單位數
	Source        SplitEventSource `json:"-" gorm:"column:source"`
	CreatedAt     time.Time        `json:"-" gorm:"column:created_at"`
	UpdatedAt     time.Time        `json:"-" gorm:"column:updated_at"`
}

func (s *SplitEvent) TableName() string {
	return "etf_split_events"
}
