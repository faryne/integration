package etf

import (
	"faryne.dev/model/entity/opendata/etf"
	"faryne.dev/model/enum"
	"faryne.dev/repository"
	"faryne.dev/service/client"
	"gorm.io/gorm"
)

type RepositoryETFWinRateStats struct {
	*repository.Repository[etf.WinRateStats]
}

func NewETFWinRateStats() *RepositoryETFWinRateStats {
	repo := repository.NewRepository[etf.WinRateStats](client.GetDB(enum.DBWalolita))
	return &RepositoryETFWinRateStats{
		Repository: repo,
	}
}

func (inst *RepositoryETFWinRateStats) GetETFWinRateStats(code string) ([]etf.WinRateStats, error) {
	stats := make([]etf.WinRateStats, 0)
	err := inst.GetDB().
		Select("w.*, c.payable_date").
		Table((&etf.WinRateStats{}).TableName()+" w ").
		Joins("LEFT JOIN "+(&etf.Share{}).TableName()+" c ON c.code = w.code AND c.ex_date = w.ex_date").
		Where("w.code = ?", code).
		Order("w.ex_date DESC").
		Find(&stats).
		Error
	return stats, err
}
func (inst *RepositoryETFWinRateStats) UpdateETFWinRate() error {
	sql := `
UPDATE ` + (&etf.ETF{}).TableName() + ` e, (
	SELECT
		inner_W.*,
		CASE 
			WHEN inner_W.success_fill_count = 0 OR inner_W.total_ex_count = 0 THEN 0
			ELSE ROUND(inner_W.success_fill_count / inner_W.total_ex_count)
		END AS win_rate
	FROM (
		SELECT
			code,
			COUNT(*) AS total_ex_count,
			SUM(CASE WHEN filled_date IS NOT NULL THEN 1 ELSE 0 END) AS success_fill_count,
			ROUND(AVG(CASE WHEN filled_date IS NOT NULL THEN DATEDIFF(filled_date, ex_date) ELSE NULL END), 1) AS avg_fill_days
		FROM ` + (&etf.WinRateStats{}).TableName() + ` 
		GROUP BY code
	) as inner_W
) as w 
SET
	e.total_ex_count = w.total_ex_count,
	e.success_fill_count = w.success_fill_count,
	e.win_rate = w.win_rate,
	e.avg_fill_days = w.avg_fill_days
WHERE e.code = w.code`
	return inst.GetDB().Exec(sql).Error
}

func (inst *RepositoryETFWinRateStats) GetETFWinRate(code string) (etf.WinRate, error) {
	var out etf.WinRate
	err := inst.calculateWinRate().
		Where("code = ?", code).
		Group("code").
		Find(&out).
		Error
	return out, err
}

func (inst *RepositoryETFWinRateStats) calculateWinRate() *gorm.DB {
	return inst.GetDB().
		Select(
			"code",
			"COUNT(*) AS total_ex_count",
			"SUM(CASE WHEN filled_date IS NOT NULL THEN 1 ELSE 0 END) AS success_fill_count",
			"ROUND(SUM(CASE WHEN filled_date IS NOT NULL THEN 1 ELSE 0 END) / COUNT(*) * 100, 2) AS win_rate",
			"ROUND(AVG(CASE WHEN filled_date IS NOT NULL THEN DATEDIFF(filled_date, ex_date) ELSE NULL END), 1) AS avg_fill_days",
		).
		Table((&etf.WinRateStats{}).TableName())
}
