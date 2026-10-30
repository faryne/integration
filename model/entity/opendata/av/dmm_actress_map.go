package av

import "time"

// DMMActressMap DMM 女優 ID 對到哪一位女優（xcity／manual），只收有同名問題的女優，手動維護
type DMMActressMap struct {
	DMMID     string    `gorm:"column:dmm_id;primaryKey"`
	Domain    string    `gorm:"column:domain"`
	AID       int       `gorm:"column:aid"`
	CreatedAt time.Time `gorm:"column:created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at"`
}

func (DMMActressMap) TableName() string {
	return "dmm_actress_maps"
}
