package etf

import (
	"faryne.dev/model/entity/opendata/etf"
	"faryne.dev/model/enum"
	"faryne.dev/repository"
	"faryne.dev/service/client"
	"gorm.io/gorm/clause"
)

type RepositoryETFSplit struct {
	*repository.Repository[etf.SplitEvent]
}

func NewETFSplit() *RepositoryETFSplit {
	return &RepositoryETFSplit{
		Repository: repository.NewRepository[etf.SplitEvent](client.GetDB(enum.DBWalolita)),
	}
}

// splitSelectFields effective_date 是 DATE，parseTime 開著時直接掃進 string 會變成 RFC3339，
// 在 SQL 端先轉好 YYYY-MM-DD，前端引擎才能直接拿來做字串比較
var splitSelectFields = []string{"id", "code", "DATE_FORMAT(effective_date, '%Y-%m-%d') AS effective_date", "ratio", "source"}

// UpsertPreviews 預告表的比率是證交所給的精確值，一律覆蓋既有紀錄（含先前由歷史表反推的）
func (inst *RepositoryETFSplit) UpsertPreviews(rows []etf.SplitEvent) error {
	if len(rows) == 0 {
		return nil
	}
	return inst.GetDB().Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "code"}, {Name: "effective_date"}},
		DoUpdates: clause.AssignmentColumns([]string{"ratio", "source", "updated_at"}),
	}).Create(&rows).Error
}

// InsertHistoriesIfAbsent 歷史表的比率是反推值，已有紀錄（多半是更精確的預告表）就不動
func (inst *RepositoryETFSplit) InsertHistoriesIfAbsent(rows []etf.SplitEvent) error {
	if len(rows) == 0 {
		return nil
	}
	return inst.GetDB().Clauses(clause.OnConflict{DoNothing: true}).Create(&rows).Error
}

// GetByCodes 依代號撈分割紀錄，生效日由舊到新
func (inst *RepositoryETFSplit) GetByCodes(codes []string) ([]etf.SplitEvent, error) {
	var out = make([]etf.SplitEvent, 0)
	if len(codes) == 0 {
		return out, nil
	}
	err := inst.GetDB().Select(splitSelectFields).
		Where("code IN ?", codes).
		Order("code, effective_date").
		Find(&out).Error
	return out, err
}

// GetFuturePreviews 撈恢復買賣日還沒到的預告紀錄，用來比對證交所是否已撤銷/延期
func (inst *RepositoryETFSplit) GetFuturePreviews(today string) ([]etf.SplitEvent, error) {
	var out = make([]etf.SplitEvent, 0)
	err := inst.GetDB().Select(splitSelectFields).
		Where("source = ? AND effective_date > ?", etf.SplitEventSourcePreview, today).
		Find(&out).Error
	return out, err
}

func (inst *RepositoryETFSplit) DeleteByIds(ids []int64) error {
	if len(ids) == 0 {
		return nil
	}
	return inst.GetDB().Where("id IN ?", ids).Delete(&etf.SplitEvent{}).Error
}
