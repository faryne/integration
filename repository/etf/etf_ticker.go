package etf

import (
	"time"

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

// GetETFTickerByCodeAndDate retrieves ETF ticker data based on the given code and date range.
// code specifies the ETF code to fetch data for.
// startDate defines the starting date for the filter (inclusive).
// endDate specifies an optional ending date for the filter (exclusive).
// Returns a slice of etf.Ticker and an error if any occurs.
func (inst *RepositoryETFTicker) GetETFTickerByCodeAndDate(code string, startDate string, endDate ...string) ([]etf.Ticker, error) {
	var out = make([]etf.Ticker, 0)
	s := startDate
	e := time.Now().Format(time.DateOnly)
	if endDate != nil && len(endDate) > 0 {
		e = endDate[0]
	}
	err := inst.GetDB().Where("code = ? AND ticker_date >= ? AND ticker_date <= ?", code, s, e).Find(&out).Error
	return out, err
}
