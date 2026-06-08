package av

import "time"

type DMMActress struct {
	ID        int       `gorm:"column:id;primaryKey"`
	Domain    string    `gorm:"column:domain;primaryKey"`
	Name      string    `gorm:"column:name"`
	Info      string    `gorm:"column:info"`
	CreatedAt time.Time `gorm:"column:created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at"`
}

func (DMMActress) TableName() string {
	return "dmm_actresses"
}
