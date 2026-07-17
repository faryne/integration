package etf

import "time"

type Favorite struct {
	Id        uint64     `json:"id" gorm:"primaryKey;autoIncrement"`
	UserID    uint64     `json:"-" gorm:"column:user_id"`
	Code      string     `json:"code" gorm:"column:code"`
	DeletedAt *time.Time `json:"-" gorm:"column:deleted_at"`
	CreatedAt time.Time  `json:"-" gorm:"column:created_at"`
	UpdatedAt time.Time  `json:"updated_at" gorm:"column:updated_at"`
}

func (f *Favorite) TableName() string {
	return "etf_favorites"
}
