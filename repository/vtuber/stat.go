package vtuber

import (
	"gorm.io/gorm/clause"

	vtuberEntity "faryne.dev/model/entity/opendata/vtuber"
	"faryne.dev/model/enum"
	"faryne.dev/service/client"
)

// UpsertStats 同一頻道同一天重跑會覆蓋
func UpsertStats(stats []vtuberEntity.Stat) error {
	if len(stats) == 0 {
		return nil
	}
	return client.GetDB(enum.DBWalolita).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "channel_id"}, {Name: "record_date"}},
		DoUpdates: clause.AssignmentColumns([]string{"subscriber_count", "view_count", "video_count", "updated_at"}),
	}).Create(&stats).Error
}

// ListStats 某頻道 sinceDate（YYYY-MM-DD，含）之後的每日統計，由舊到新。
// record_date 用 DATE_FORMAT 轉字串讀回，避免 parseTime 把 DATE 掃成帶時區的時間。
func ListStats(channelID, sinceDate string) ([]vtuberEntity.Stat, error) {
	out := make([]vtuberEntity.Stat, 0)
	err := client.GetDB(enum.DBWalolita).Model(&vtuberEntity.Stat{}).
		Select("channel_id, DATE_FORMAT(record_date, '%Y-%m-%d') AS record_date, subscriber_count, view_count, video_count").
		Where("channel_id = ? AND record_date >= ?", channelID, sinceDate).
		Order("record_date").Find(&out).Error
	return out, err
}
