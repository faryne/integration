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

// GetByCodes 只查詢即時報價功能需要的欄位（market 用來組 ex_ch 前綴、latest_close
// 當作沒有即時價時的 fallback），不需要 GetETFByCode 那種join 一堆歷史配息欄位。
func (inst *RepositoryETFCode) GetByCodes(codes []string) ([]etf.ETF, error) {
	var etfs = make([]etf.ETF, 0)
	if len(codes) == 0 {
		return etfs, nil
	}
	err := inst.GetDB().Table((&etf.ETF{}).TableName()).
		Select("code, market, latest_close").
		Where("code IN ?", codes).
		Find(&etfs).Error

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
		" 	c.avg_fill_days, " +
		" 	c.range_position, " +
		" 	c.latest_close, " +
		" 	c.ma5, " +
		" 	c.ma20, " +
		" 	c.ma20_bias_rate " +
		"FROM " + (&etf.ETF{}).TableName() + " as c " +
		// 部署機是 MySQL 5.7，不支援 ROW_NUMBER() OVER(...)（8.0 才有），
		// 改用 correlated subquery 依 id 取每檔 ETF 最新一筆 share > 0 的紀錄，
		// 確保 ex_date/share/payable_date 保證來自同一列，且 id 唯一不會重複列。
		"LEFT JOIN " + (&etf.Share{}).TableName() + " as tmp ON tmp.id = (" +
		"	SELECT s2.id FROM " + (&etf.Share{}).TableName() + " as s2 " +
		"	WHERE s2.code = c.code AND s2.share > 0 " +
		"	ORDER BY s2.ex_date DESC, s2.id DESC LIMIT 1" +
		")"
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

func (inst *RepositoryETFCode) UpdateETFWinRate(input etf.ETF) error {
	return inst.GetDB().Table((&etf.ETF{}).TableName()).Where("code = ?", input.Code).Updates(map[string]interface{}{
		"success_fill_count": input.SuccessFillCount,
		"total_ex_count":     input.TotalExCount,
		"win_rate":           input.WinRate,
		"avg_fill_days":      input.AvgFillDays,
	}).Error
}

func (inst *RepositoryETFCode) UpdateETFTechnicalIndicators(input etf.ETF) error {
	return inst.GetDB().Table((&etf.ETF{}).TableName()).Where("code = ?", input.Code).Updates(map[string]interface{}{
		"range_position": input.RangePosition,
		"latest_close":   input.LatestClose,
		"ma5":            input.MA5,
		"ma20":           input.MA20,
		"ma20_bias_rate": input.MA20BiasRate,
	}).Error
}
