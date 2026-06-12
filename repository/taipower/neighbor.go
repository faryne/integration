package taipower

import (
	"errors"

	taipowerModel "faryne.dev/model/entity/opendata/taipower"
	"faryne.dev/model/enum"
	"faryne.dev/service/client"
	"gorm.io/gorm"
)

type NeighborRepository struct {
	db *gorm.DB
}

func NewNeighborRepository() *NeighborRepository {
	return &NeighborRepository{
		db: client.GetDB(enum.DBWalolita),
	}
}

func (r *NeighborRepository) Upsert(item *taipowerModel.Neighbor) error {
	var existing taipowerModel.Neighbor
	result := r.db.
		Where(
			"BINARY cityarea = BINARY ? AND BINARY unit = BINARY ? AND BINARY summary = BINARY ?",
			item.CityArea,
			item.Unit,
			item.Summary,
		).
		First(&existing)
	if result.Error == nil {
		item.ID = existing.ID
		item.CreatedOn = existing.CreatedOn
		return r.db.Model(&existing).Updates(map[string]any{
			"obj_month_id": item.ObjMonthID,
			"apply_reason": item.ApplyReason,
			"cash":         item.Cash,
			"obj_year":     item.ObjYear,
			"obj_month":    item.ObjMonth,
		}).Error
	}
	if !errors.Is(result.Error, gorm.ErrRecordNotFound) {
		return result.Error
	}
	return r.db.Create(item).Error
}

func (r *NeighborRepository) GetBatch(afterID uint, limit int) ([]taipowerModel.Neighbor, error) {
	var items []taipowerModel.Neighbor
	err := r.db.
		Where("id > ?", afterID).
		Order("id ASC").
		Limit(limit).
		Find(&items).
		Error
	return items, err
}
