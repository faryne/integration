package etf

import (
	"faryne.dev/model/entity/opendata/etf"
	"faryne.dev/model/enum"
	"faryne.dev/repository"
	"faryne.dev/service/client"
	"gorm.io/gorm/clause"
)

type RepositoryETFShare struct {
	*repository.Repository[etf.Share]
}

func NewETFShare() *RepositoryETFShare {
	repo := repository.NewRepository[etf.Share](client.GetDB(enum.DBWalolita))
	return &RepositoryETFShare{
		Repository: repo,
	}
}

func (inst *RepositoryETFShare) UpdateETFTShareBatch(etfs []etf.Share) error {
	res := inst.GetDB().Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "code"}, {Name: "ex_date"}},
		DoUpdates: clause.AssignmentColumns([]string{"payable_date", "share", "updated_at"}),
	}).Table("etf_shares").CreateInBatches(etfs, 100)
	return res.Error
}

func (inst *RepositoryETFShare) GetETFShareByCode(code string) ([]etf.Share, error) {
	var out = make([]etf.Share, 0)
	err := inst.GetDB().Where("code = ?", code).Order("ex_date DESC").Find(&out).Error
	return out, err
}
