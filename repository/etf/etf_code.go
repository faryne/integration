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
		Columns: []clause.Column{{Name: "code"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"name", "company", "market", "target", "publish_date", "updated_at",
			"win_rate", "avg_fill_days", "success_fill_count", "total_ex_count",
		}),
	}).Table("etf_codes").CreateInBatches(etfs, 100)
	return res.Error
}

func (inst *RepositoryETFCode) getCodeCommonSql() string {
	return "" +
		"SELECT " +
		"	c.code, c.name, c.company, c.target, c.market, c.publish_date, " +
		"	tmp.ex_date, " +
		"	tmp.share " +
		"FROM " + (&etf.ETF{}).TableName() + " as c " +
		"LEFT JOIN (SELECT MAX(`ex_date`) as ex_date, `code`, MAX(`share`) as `share` FROM " + (&etf.Share{}).TableName() + " WHERE `share` > 0 GROUP BY `code`) tmp ON tmp.code = c.code"
}
func (inst *RepositoryETFCode) GetCodesWithRecentShare() ([]etf.WithRecentShareETF, error) {
	var out []etf.WithRecentShareETF

	err := inst.GetDB().Raw(inst.getCodeCommonSql()).Scan(&out).Error
	return out, err
}

func (inst *RepositoryETFCode) GetCodesWithUpcomingShare(codes []string) ([]etf.WithRecentShareETF, error) {
	var out []etf.WithRecentShareETF
	sql := inst.getCodeCommonSql()
	sql += " WHERE c.code IN (?)"

	err := inst.GetDB().Raw(sql, codes).Scan(&out).Error
	return out, err
}
