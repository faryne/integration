package etf

import (
	"faryne.dev/model/entity/opendata/etf"
	"faryne.dev/model/enum"
	"faryne.dev/repository"
	"faryne.dev/service/client"
	"gorm.io/gorm/clause"
)

type RepositoryETFTicker struct {
	*repository.Repository[etf.Ticker]
}

func NewETFTicker() *RepositoryETFTicker {
	repo := repository.NewRepository[etf.Ticker](client.GetDB(enum.DBWalolita))
	return &RepositoryETFTicker{
		Repository: repo,
	}
}

func (inst *RepositoryETFTicker) UpdateETFTickerBatch(etfs []etf.Ticker) error {
	res := inst.GetDB().Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "code"}, {Name: "ticker_date"}},
		DoUpdates: clause.AssignmentColumns([]string{"open", "close", "min", "max", "updated_at"}),
	}).Table("etf_tickers").CreateInBatches(etfs, 100)
	return res.Error
}
