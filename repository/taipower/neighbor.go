package taipower

import (
	"context"
	"fmt"

	taipowerModel "faryne.dev/model/entity/opendata/taipower"
	"faryne.dev/model/enum"
	"faryne.dev/service/client"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/plugin/dbresolver"
)

type NeighborRepository struct {
	db *gorm.DB
}

type NeighborSummary struct {
	Count          int64   `gorm:"column:count"`
	TotalCash      float64 `gorm:"column:total_cash"`
	LatestMonth    int     `gorm:"column:latest_month"`
	VersionedCount int64   `gorm:"-"`
}

type NeighborRevisionCandidate struct {
	ObjYear    int   `gorm:"column:obj_year"`
	ObjMonth   int   `gorm:"column:obj_month"`
	ObjMonthID int   `gorm:"column:obj_month_id"`
	Count      int64 `gorm:"column:count"`
}

func NewNeighborRepository() *NeighborRepository {
	return &NeighborRepository{
		db: client.GetDB(enum.DBWalolita),
	}
}

func (r *NeighborRepository) Upsert(item *taipowerModel.Neighbor) error {
	return r.db.Clauses(clause.OnConflict{
		DoUpdates: clause.Assignments(map[string]any{
			"id":              gorm.Expr("LAST_INSERT_ID(id)"),
			"obj_month_id":    item.ObjMonthID,
			"apply_reason":    item.ApplyReason,
			"source_cityarea": item.SourceCityArea,
		}),
	}).Create(item).Error
}

func (r *NeighborRepository) GetBatch(afterID uint, limit int) ([]taipowerModel.Neighbor, error) {
	var items []taipowerModel.Neighbor
	// 同步作業需與剛寫入的主庫資料一致，不能從可能落後的 replica 回填索引。
	err := r.db.Clauses(dbresolver.Write).
		Where("id > ?", afterID).
		Order("id ASC").
		Limit(limit).
		Find(&items).
		Error
	return items, err
}

// Summary 用於發布前比對 MySQL 與搜尋索引，不查個別敏感摘要。
func (r *NeighborRepository) Summary() (NeighborSummary, error) {
	var summary NeighborSummary
	err := r.db.Clauses(dbresolver.Write).Model(&taipowerModel.Neighbor{}).
		Select("COUNT(*) AS count, COALESCE(SUM(cash), 0) AS total_cash, COALESCE(MAX(obj_year * 100 + obj_month), 0) AS latest_month").
		Scan(&summary).Error
	return summary, err
}

// WithSyncLock 以同一條 MySQL 連線持有 advisory lock，避免排程與手動回補同時發布。
func (r *NeighborRepository) WithSyncLock(run func() error) error {
	// GORM 的 Raw callback 會重新選擇連線池；直接持有 primary 的 sql.Conn 才能確保鎖在同一連線上釋放。
	db, err := r.db.DB()
	if err != nil {
		return err
	}
	ctx := context.Background()
	conn, err := db.Conn(ctx)
	if err != nil {
		return err
	}
	defer conn.Close()
	var acquired int
	if err := conn.QueryRowContext(ctx, "SELECT GET_LOCK(?, 0)", "taipower_neighbor_sync").Scan(&acquired); err != nil {
		return err
	}
	if acquired != 1 {
		return fmt.Errorf("taipower neighbor sync is already running")
	}
	defer conn.ExecContext(ctx, "DO RELEASE_LOCK(?)", "taipower_neighbor_sync")
	return run()
}

// RevisionCandidates 僅提供同月份來源項次碰撞線索，不自動合併核准案。
func (r *NeighborRepository) RevisionCandidates(from, to int) ([]NeighborRevisionCandidate, error) {
	var rows []NeighborRevisionCandidate
	err := r.db.Clauses(dbresolver.Write).Model(&taipowerModel.Neighbor{}).
		Select("obj_year, obj_month, obj_month_id, COUNT(*) AS count").
		Where("obj_year * 100 + obj_month BETWEEN ? AND ?", from, to).
		Group("obj_year, obj_month, obj_month_id").Having("COUNT(*) > 1").
		Find(&rows).Error
	return rows, err
}
