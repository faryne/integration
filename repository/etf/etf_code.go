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

func (inst *RepositoryETFCode) GetByMarket(market enum.StockMarket) ([]etf.ETF, error) {
	var etfs = make([]etf.ETF, 0)
	err := inst.GetDB().Table((&etf.ETF{}).TableName()).Where("market = ?", market).Find(&etfs).Error

	return etfs, err
}

func (inst *RepositoryETFCode) UpdateETFCodeBatch(etfs []etf.ETF) error {
	res := inst.GetDB().Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "code"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"name", "company", "market", "target", "publish_date", "updated_at",
		}),
	}).Table((&etf.ETF{}).TableName()).CreateInBatches(etfs, 100)
	return res.Error
}

func (inst *RepositoryETFCode) UpdateETFCodeBatchWinRate(etfs []etf.ETF) error {
	res := inst.GetDB().Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "code"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"total_ex_count", "success_fill_count", "win_rate", "avg_fill_days", "updated_at",
		}),
	}).Table((&etf.ETF{}).TableName()).CreateInBatches(etfs, 100)
	return res.Error
}

func (inst *RepositoryETFCode) getCodeCommonSql() string {
	return "" +
		"SELECT " +
		"	c.code, c.name, c.company, c.target, c.market, c.publish_date, " +
		"	tmp.ex_date, " +
		"	tmp.share, " +
		"	tmp.payable_date, " +
		"	c.total_ex_count, " +
		" 	c.success_fill_count, " +
		" 	c.win_rate, " +
		" 	c.avg_fill_days " +
		"FROM " + (&etf.ETF{}).TableName() + " as c " +
		"LEFT JOIN (SELECT MAX(`ex_date`) as ex_date, `code`, MAX(`share`) as `share`, MAX(`payable_date`) as payable_date FROM " + (&etf.Share{}).TableName() + " WHERE `share` > 0 GROUP BY `code`) tmp ON tmp.code = c.code"
}
func (inst *RepositoryETFCode) GetAllETF() ([]etf.ETF, error) {
	var out []etf.ETF

	err := inst.GetDB().Raw(inst.getCodeCommonSql()).Scan(&out).Error
	return out, err
}

func (inst *RepositoryETFCode) GetETFByCode(code string) (*etf.ETF, error) {
	var out etf.ETF
	sql := inst.getCodeCommonSql() + " WHERE c.code = ?"
	err := inst.GetDB().Raw(sql, code).First(&out).Error
	return &out, err
}

func (inst *RepositoryETFCode) GetUpcomingExETFByDate(date string) ([]etf.ETF, error) {
	var out = make([]etf.ETF, 0)
	sql := inst.getCodeCommonSql() + " WHERE tmp.ex_date = ?"
	err := inst.GetDB().
		Raw(sql, date).
		Order("c.code ASC").
		Scan(&out).
		Error
	return out, err
}

func (inst *RepositoryETFCode) GetUpcomingExETFByDateRange(startDate, endDate string) ([]etf.ETF, error) {
	var out = make([]etf.ETF, 0)
	sql := inst.getCodeCommonSql() + " WHERE tmp.ex_date >= ? AND tmp.ex_date <= ?"
	err := inst.GetDB().
		Raw(sql, startDate, endDate).
		Order("c.ex_date DESC").
		Scan(&out).
		Error
	return out, err
}
