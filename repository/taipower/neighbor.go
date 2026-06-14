package taipower

import (
	taipowerModel "faryne.dev/model/entity/opendata/taipower"
	"faryne.dev/model/enum"
	"faryne.dev/service/client"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
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
	return r.db.Clauses(clause.OnConflict{
		DoUpdates: clause.Assignments(map[string]any{
			"id":           gorm.Expr("LAST_INSERT_ID(id)"),
			"obj_month_id": item.ObjMonthID,
			"apply_reason": item.ApplyReason,
		}),
	}).Create(item).Error
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
