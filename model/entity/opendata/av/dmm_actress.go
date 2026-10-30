package av

import "time"

type DMMActress struct {
	ID     int    `gorm:"column:id;primaryKey"`
	Domain string `gorm:"column:domain;primaryKey"`
	Name   string `gorm:"column:name"`
	Info   string `gorm:"column:info"`
	// Overrides 核准過的手動修改（JSON，只含被改的欄位），xcity 同步時會蓋回去
	Overrides *string   `gorm:"column:overrides"`
	CreatedAt time.Time `gorm:"column:created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at"`
}

func (DMMActress) TableName() string {
	return "dmm_actresses"
}
