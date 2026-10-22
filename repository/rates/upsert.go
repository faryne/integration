package rates

import (
	"gorm.io/gorm/clause"

	"faryne.dev/model/entity/opendata/rates"
	"faryne.dev/model/enum"
	"faryne.dev/service/client"
)

// UpsertRates 批次寫入匯率；同一家同一天同幣別（unique key）已存在時只更新買賣價
func UpsertRates(records []rates.RateRecord) error {
	if len(records) == 0 {
		return nil
	}
	return client.GetDB(enum.DBWalolita).Clauses(clause.OnConflict{
		DoUpdates: clause.AssignmentColumns([]string{"buy_rate", "sell_rate", "updated_at"}),
	}).Create(&records).Error
}
