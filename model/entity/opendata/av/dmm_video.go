package av

import "time"

// DMMVideo 對應 dmm 表；id 同時是 ES dmmvideos 的 document id（沿用 logstash 時代的 vid）
type DMMVideo struct {
	ID    int    `gorm:"column:id;primaryKey"`
	No    string `gorm:"column:no"`
	Title string `gorm:"column:title"`
	Link  string `gorm:"column:link"`
	Thumb string `gorm:"column:thumb"`
	Info  string `gorm:"column:info"`
	// IsOrphan 同步資料確定失敗（DMM 已查無、沒有官方番號），不再顯示同步按鈕；重新抓到時清回 false
	IsOrphan   bool       `gorm:"column:is_orphan"`
	OrphanedAt *time.Time `gorm:"column:orphaned_at"`
	CreatedAt  time.Time  `gorm:"column:created_at"`
	UpdatedAt  time.Time  `gorm:"column:updated_at"`
}

func (DMMVideo) TableName() string {
	return "dmm"
}
