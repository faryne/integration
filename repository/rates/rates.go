package rates

import (
	"faryne.dev/model/entity/opendata/rates"
	"faryne.dev/model/enum"
	"faryne.dev/service/client"
	"time"
)

func FetchRates(req rates.RateRequest) ([]rates.Rate, error) {
	var db = client.GetDB(enum.DBWalolita)
	var out = make([]rates.Rate, 0)
	query := db.Table("rates")
	if req.ServiceName != "" {
		query.Where("service_name = ?", req.ServiceName)
	}
	if !req.BeginDate.Time().IsZero() {
		query.Where("record_date >= ?", req.BeginDate.Time().Format(time.DateOnly))
	}
	if !req.EndDate.Time().IsZero() {
		query.Where("record_date <= ?", req.EndDate.Time().Format(time.DateOnly))
	}
	if len(req.Currencies) > 0 {
		query.Where("base IN (?)", req.Currencies)
	}
	err := query.Order("record_date DESC").Find(&out).Error
	return out, err
}

func GetBanks() ([]string, error) {
	var db = client.GetDB(enum.DBWalolita)
	var out = make([]string, 0)

	err := db.Table("rates").Group("service_name").Pluck("service_name", &out).Error
	return out, err
}
