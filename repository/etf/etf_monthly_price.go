package etf

import (
	"faryne.dev/model/entity/opendata/etf"
	"faryne.dev/model/enum"
	"faryne.dev/repository"
	"faryne.dev/service/client"
	"gorm.io/gorm/clause"
)

type RepositoryETFMonthlyPrice struct {
	*repository.Repository[etf.MonthlyPrice]
}

func NewETFMonthlyPrice() *RepositoryETFMonthlyPrice {
	repo := repository.NewRepository[etf.MonthlyPrice](client.GetDB(enum.DBWalolita))
	return &RepositoryETFMonthlyPrice{
		Repository: repo,
	}
}

func (inst *RepositoryETFMonthlyPrice) GetByYear(code string, year int) ([]etf.MonthlyPrice, error) {
	var out []etf.MonthlyPrice
	err := inst.GetDB().
		Table((&etf.MonthlyPrice{}).TableName()).
		Where("code = ? AND year = ? AND month > 0", code, year).
		Order("month ASC").
		Find(&out).
		Error
	return out, err
}

func (inst *RepositoryETFMonthlyPrice) GetByYearMonth(code string, year int, month int) (*etf.MonthlyPrice, error) {
	var out etf.MonthlyPrice
	err := inst.GetDB().
		Table((&etf.MonthlyPrice{}).TableName()).
		Where("code = ? AND year = ? AND month = ?", code, year, month).
		First(&out).
		Error
	if err != nil {
		return nil, err
	}
	return &out, nil
}

func (inst *RepositoryETFMonthlyPrice) UpsertBatch(items []etf.MonthlyPrice) error {
	if len(items) == 0 {
		return nil
	}
	return inst.GetDB().Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "code"}, {Name: "year"}, {Name: "month"}},
		DoUpdates: clause.AssignmentColumns([]string{"avg_price", "updated_at"}),
	}).Table((&etf.MonthlyPrice{}).TableName()).CreateInBatches(items, 100).Error
}
