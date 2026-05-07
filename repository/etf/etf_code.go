package etf

import (
	"faryne.dev/model/entity/opendata/etf"
	"faryne.dev/model/enum"
	"faryne.dev/repository"
	"faryne.dev/service/client"
	"gorm.io/gorm/clause"
)

type RepositoryETFCode struct {
	*repository.Repository[etf.ETF]
}

func NewETFCode() *RepositoryETFCode {
	repo := repository.NewRepository[etf.ETF](client.GetDB(enum.DBWalolita))
	return &RepositoryETFCode{
		Repository: repo,
	}
}

func (inst *RepositoryETFCode) UpdateETFCodeBatch(etfs []etf.ETF) error {
	res := inst.GetDB().Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "code"}},
		DoUpdates: clause.AssignmentColumns([]string{"name", "company", "market", "target", "publish_date", "updated_at"}),
	}).Table("etf_codes").CreateInBatches(etfs, 100)
	return res.Error
}
