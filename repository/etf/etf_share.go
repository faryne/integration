package etf

import (
	"time"

	"faryne.dev/model/entity/opendata/etf"
	"faryne.dev/model/enum"
	"faryne.dev/repository"
	"faryne.dev/service/client"
	"gorm.io/gorm"
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
	}).Table((&etf.Share{}).TableName()).CreateInBatches(etfs, 100)
	return res.Error
}

func (inst *RepositoryETFShare) getFields() []string {
	return []string{
		"s.code",
		"s.ex_date",
		"s.payable_date",
		"s.share",
		"s.ex_ticker_price", // 除權日前一天收盤價
		"s.yield_rate",
		"s.filled_date",
		"s.filled_ticker_price",
		"s.filled_days",
		"s.filled_trade_days",
	}
}

func (inst *RepositoryETFShare) GetETFShareByCode(code string) ([]etf.Share, error) {
	var out = make([]etf.Share, 0)
	err := inst.GetDB().
		Select(inst.getFields()).
		Table((&etf.Share{}).TableName()+" as s").
		Where("s.code = ?", code).
		Order("s.ex_date DESC").
		Find(&out).
		Error
	return out, err
}

func (inst *RepositoryETFShare) getUpcomingExETF() *gorm.DB {
	return inst.GetDB().
		Select(inst.getFields()).
		Table((&etf.Share{}).TableName() + " s").
		Joins("LEFT JOIN " + (&etf.ETF{}).TableName() + " c ON s.code = c.code")
}

// GetExPriceAndYieldRate 更新除權收盤價與殖利率
func (inst *RepositoryETFShare) GetExPriceAndYieldRate() ([]etf.Share, error) {
	var out = make([]etf.Share, 0)
	sql := `
SELECT 
    code, 
    ex_date,
	ROUND((o.share/IFNULL(
		(SELECT close FROM ` + (&etf.Ticker{}).TableName() + ` WHERE code = o.code AND ticker_date < o.ex_date ORDER BY ticker_date DESC LIMIT 1),
		-1
	))*100, 2) as yield_rate,
	IFNULL(
		(SELECT close FROM ` + (&etf.Ticker{}).TableName() + ` WHERE code = o.code AND ticker_date < o.ex_date ORDER BY ticker_date DESC LIMIT 1),
		-1
	) as ex_ticker_price
FROM ` + (&etf.Share{}).TableName() + ` as o
WHERE yield_rate = 0 AND ex_date < NOW()
ORDER BY ex_date DESC
`
	err := inst.GetDB().Raw(sql).Scan(&out).Error
	return out, err
}

// UpdateExPriceAndYieldRate 更新除權收盤價與殖利率
func (inst *RepositoryETFShare) UpdateExPriceAndYieldRate(share etf.Share) error {
	t, _ := time.Parse(time.RFC3339, share.ExDate)
	return inst.GetDB().Table((&etf.Share{}).TableName()).Where("code = ? AND ex_date = ?", share.Code, t.Format(time.DateOnly)).Updates(
		map[string]interface{}{
			"yield_rate":      share.YieldRate,
			"ex_ticker_price": share.ExTickerPrice,
		},
	).Error
}

func (inst *RepositoryETFShare) GetFilled() ([]etf.Share, error) {
	var out = make([]etf.Share, 0)
	sql := `
SELECT 
    code, 
    ex_date,
    IFNULL(
    	(SELECT ticker_date FROM ` + (&etf.Ticker{}).TableName() + ` WHERE code = o.code AND ticker_date > o.ex_date AND close > o.ex_ticker_price ORDER BY ticker_date ASC LIMIT 1),
		"1900-01-01"
    ) AS filled_date,
	(SELECT close FROM ` + (&etf.Ticker{}).TableName() + ` WHERE code = o.code AND ticker_date > o.ex_date AND close > o.ex_ticker_price ORDER BY ticker_date ASC LIMIT 1) AS filled_ticker_price 
FROM ` + (&etf.Share{}).TableName() + ` as o
WHERE filled_days = -1 AND ex_date < NOW()
ORDER BY ex_date DESC
`
	err := inst.GetDB().Raw(sql).Scan(&out).Error
	return out, err
}

func (inst *RepositoryETFShare) UpdateFilledDays(share etf.Share) error {
	//t1, _ := time.Parse(time.RFC3339, share.FilledDate)
	t2, _ := time.Parse(time.RFC3339, share.ExDate)
	sql := `
UPDATE ` + (&etf.Share{}).TableName() + ` as o
SET 
	filled_date = ?,
	filled_days = datediff(?, ex_date),
	filled_ticker_price = ?,
	filled_trade_days = (SELECT count(1) FROM ` + (&etf.Ticker{}).TableName() + ` WHERE code = ? AND ticker_date > o.ex_date AND ticker_date <= ?)
WHERE 
	code = ? AND ex_date = ?
`
	return inst.GetDB().Exec(
		sql,
		share.FilledDate,
		share.FilledDate,
		share.FilledTickerPrice,
		share.Code,
		share.FilledDate,
		share.Code,
		t2.Format(time.DateOnly),
	).Error
}

func (inst *RepositoryETFShare) CountETFWinRate() ([]etf.ETF, error) {
	out := make([]etf.ETF, 0)
	sql := `
SELECT 
	tmp.code, 
	tmp.success_fill_count,
	tmp.total_ex_count,
	ROUND((tmp.success_fill_count/tmp.total_ex_count)*100, 2) as win_rate,
	ROUND(tmp.filled_days/tmp.total_ex_count, 4) as avg_fill_days
FROM (
	SELECT 
		o.code,
		count(1) as success_fill_count,
		(SELECT count(1) FROM etf_shares WHERE code = o.code) as total_ex_count,
		  SUM(filled_days) as filled_days
	FROM ` + (&etf.Share{}).TableName() + ` o
	WHERE filled_days != -1
	GROUP BY o.code
) as tmp
`
	err := inst.GetDB().Raw(sql).Scan(&out).Error
	return out, err
}
