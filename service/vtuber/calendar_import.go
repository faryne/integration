package vtuber

import (
	"encoding/json"
	"fmt"
	"os"
	"regexp"
	"strings"

	"go.uber.org/zap"

	vtuberEntity "faryne.dev/model/entity/opendata/vtuber"
	vtuberRepository "faryne.dev/repository/vtuber"
	"faryne.dev/service/log"
)

var channelIDPattern = regexp.MustCompile(`^UC[A-Za-z0-9_-]{22}$`)

// ImportCalendars 匯入 Apps Script 時代建好的行事曆。
// 檔案格式跟舊 Firebase 的 hololive/calendar 節點一樣：{"all": "<總表 ID>", "UC...": "<個人行事曆 ID>"}，
// 由 DevelopDocuments/opendata/vtuber-calendar-export.gs 匯出。可以重跑，同一個 key 會覆蓋。
func ImportCalendars(path string) (int, error) {
	body, err := os.ReadFile(path)
	if err != nil {
		return 0, err
	}
	var mapping map[string]string
	if err := json.Unmarshal(body, &mapping); err != nil {
		return 0, fmt.Errorf("parse %s: %w", path, err)
	}
	rows, err := calendarRows(mapping)
	if err != nil {
		return 0, err
	}
	return len(rows), vtuberRepository.UpsertCalendars(rows)
}

// calendarRows 檢查 key（all 或 UC 頻道 ID）與行事曆 ID 都有值
func calendarRows(mapping map[string]string) ([]vtuberEntity.Calendar, error) {
	rows := make([]vtuberEntity.Calendar, 0, len(mapping))
	for key, id := range mapping {
		key, id = strings.TrimSpace(key), strings.TrimSpace(id)
		if key != vtuberEntity.CalendarKeyAll && !channelIDPattern.MatchString(key) {
			return nil, fmt.Errorf("invalid calendar key %q: must be %q or a YouTube channel ID", key, vtuberEntity.CalendarKeyAll)
		}
		if id == "" {
			return nil, fmt.Errorf("calendar ID of %q is empty", key)
		}
		rows = append(rows, vtuberEntity.Calendar{CalendarKey: key, CalendarID: id})
	}
	return rows, nil
}

// RunImportCalendars -cmd vtuber-import-calendars -calendarFile <path> 的進入點
func RunImportCalendars(path string) {
	if path == "" {
		log.Logger().Error("Import vtuber calendars failed", zap.Error(fmt.Errorf("calendarFile is required")))
		return
	}
	count, err := ImportCalendars(path)
	if err != nil {
		log.Logger().Error("Import vtuber calendars failed", zap.Error(err))
		return
	}
	log.Logger().Info("Import vtuber calendars finished", zap.Int("calendars", count))
}
