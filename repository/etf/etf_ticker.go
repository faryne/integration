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
		Columns: []clause.Column{{Name: "code"}, {Name: "ticker_date"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"open", "close", "min", "max", "volume", "trading_money", "trading_turnover", "updated_at",
		}),
	}).Table("etf_tickers").CreateInBatches(etfs, 100)
	return res.Error
}

func (inst *RepositoryETFTicker) UpdateTickerTechnicalIndicators(input etf.Ticker) error {
	return inst.GetDB().Table((&etf.Ticker{}).TableName()).
		Where("code = ? AND ticker_date = ?", input.Code, input.Date).
		Updates(map[string]interface{}{
			"range_position_20":  input.RangePosition20,
			"range_position_60":  input.RangePosition60,
			"range_position_120": input.RangePosition120,
			"ma5":                input.MA5,
			"ma20":               input.MA20,
			"ma60":               input.MA60,
			"ma120":              input.MA120,
		}).Error
}

// GetFirstTickerDate 獲取指定 code 的最早股價日期，如果 code 為空則獲取所有資料的最早日期
func (inst *RepositoryETFTicker) GetFirstTickerDate(code string) (string, error) {
	var date string
	query := inst.GetDB().Table("etf_tickers").Select("MIN(ticker_date)")
	if code != "" {
		query = query.Where("code = ?", code)
	}
	err := query.Row().Scan(&date)
	return date, err
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
	err := inst.GetDB().Table((&etf.Ticker{}).TableName()).
		Where("code = ? AND ticker_date >= ? AND ticker_date <= ?", code, s, e).
		Order("ticker_date ASC").
		Find(&out).Error
	return out, err
}

func (inst *RepositoryETFTicker) GetAllTickerByCode(code string) ([]etf.Ticker, error) {
	var out = make([]etf.Ticker, 0)
	err := inst.GetDB().Table((&etf.Ticker{}).TableName()).
		Where("code = ?", code).
		Order("ticker_date ASC").
		Find(&out).Error
	return out, err
}

func (inst *RepositoryETFTicker) GetLatestTickersByCode(code string, limit int) ([]etf.Ticker, error) {
	var out = make([]etf.Ticker, 0)
	if limit <= 0 {
		return out, nil
	}

	subQuery := inst.GetDB().Table((&etf.Ticker{}).TableName()).
		Where("code = ?", code).
		Order("ticker_date DESC").
		Limit(limit)
	err := inst.GetDB().Table("(?) AS latest_tickers", subQuery).
		Order("ticker_date ASC").
		Find(&out).Error
	return out, err
}

func (inst *RepositoryETFTicker) GetLatestTickersByCodeBeforeOrEqualDate(code string, endDate string, limit int) ([]etf.Ticker, error) {
	var out = make([]etf.Ticker, 0)
	if limit <= 0 {
		return out, nil
	}

	subQuery := inst.GetDB().Table((&etf.Ticker{}).TableName()).
		Where("code = ? AND ticker_date <= ?", code, endDate).
		Order("ticker_date DESC").
		Limit(limit)
	err := inst.GetDB().Table("(?) AS latest_tickers", subQuery).
		Order("ticker_date ASC").
		Find(&out).Error
	return out, err
}

// GetLatestTickerByCodeAndDate 抓出指定日期前一天的股價資訊
func (inst *RepositoryETFTicker) GetLatestTickerByCodeAndDate(code string, startDate string) (*etf.Ticker, error) {
	var out etf.Ticker
	s := startDate

	err := inst.GetDB().
		Table((&etf.Ticker{}).TableName()).
		Where("code = ? AND ticker_date < ?", code, s).
		Order("ticker_date DESC").
		First(&out).
		Error
	return &out, err
}

// GetMonthlyAverages 獲取指定 code 的所有月份平均股價
func (inst *RepositoryETFTicker) GetMonthlyAverages(code string) ([]etf.MonthlyPrice, error) {
	var out []etf.MonthlyPrice
	// 使用 MySQL 的 YEAR() 和 MONTH() 函數進行分組
	err := inst.GetDB().Table((&etf.Ticker{}).TableName()).
		Select("code, YEAR(ticker_date) as year, MONTH(ticker_date) as month, ROUND(AVG(close), 4) as avg_price").
		Where("code = ?", code).
		Group("code, year, month").
		Order("year ASC, month ASC").
		Scan(&out).Error
	return out, err
}
