package vtuber

import (
	"gorm.io/gorm/clause"

	vtuberEntity "faryne.dev/model/entity/opendata/vtuber"
	"faryne.dev/model/enum"
	"faryne.dev/service/client"
)

// ListCalendars 回傳 calendar_key（all 或 channel ID）→ Google Calendar ID
func ListCalendars() (map[string]string, error) {
	var rows []vtuberEntity.Calendar
	if err := client.GetDB(enum.DBWalolita).Find(&rows).Error; err != nil {
		return nil, err
	}
	out := make(map[string]string, len(rows))
	for _, r := range rows {
		out[r.CalendarKey] = r.CalendarID
	}
	return out, nil
}

// UpsertCalendars 以 calendar_key 為準寫入；匯入舊行事曆時可以重跑覆蓋
func UpsertCalendars(calendars []vtuberEntity.Calendar) error {
	if len(calendars) == 0 {
		return nil
	}
	return client.GetDB(enum.DBWalolita).Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "calendar_key"}},
		DoUpdates: clause.AssignmentColumns([]string{"calendar_id", "updated_at"}),
	}).Create(&calendars).Error
}
