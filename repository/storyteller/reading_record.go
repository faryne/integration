package storyteller

import (
	"strings"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

// ReadingRecords 回傳讀者在某專案底下的所有閱讀進度；可見性由 service 依目前可讀的內容再過濾一次。
func (r *Repository) ReadingRecords(userID, projectID uint64) ([]storytellerModel.ReadingRecord, error) {
	rows := make([]storytellerModel.ReadingRecord, 0)
	err := r.db.Where("user_id = ? AND project_id = ?", userID, projectID).Find(&rows).Error
	return rows, err
}

// UpsertReadingRecords 批次寫入進度，同一對象已有紀錄時：
//   - completed_at：只在「還沒讀完、這次到 100」時填上，之後不再變動
//   - updated_at：只有進度往前推時才更新（「繼續閱讀」要指向真正有在讀的那篇）
//   - progress：取較大值，回頭重讀不會倒退
//
// MySQL 的 ON DUPLICATE KEY UPDATE 由左到右求值、後面的運算式會看到前面改過的值，
// 所以 progress 一定要放最後，前兩個欄位才能拿舊的 progress 比較。
func (r *Repository) UpsertReadingRecords(rows []storytellerModel.ReadingRecord) error {
	if len(rows) == 0 {
		return nil
	}
	now := time.Now()
	placeholders := make([]string, 0, len(rows))
	args := make([]any, 0, len(rows)*8)
	for _, row := range rows {
		var completedAt *time.Time
		if row.Progress >= 100 {
			completedAt = &now
		}
		placeholders = append(placeholders, "(?, ?, ?, ?, ?, ?, ?, ?)")
		args = append(args, row.UserID, row.ProjectID, row.TargetType, row.TargetID, row.Progress, completedAt, now, now)
	}
	return r.db.Exec(`INSERT INTO storyteller_reading_records
		(user_id, project_id, target_type, target_id, progress, completed_at, created_at, updated_at)
		VALUES `+strings.Join(placeholders, ", ")+`
		ON DUPLICATE KEY UPDATE
			completed_at = IF(completed_at IS NULL, VALUES(completed_at), completed_at),
			updated_at = IF(VALUES(progress) > progress, VALUES(updated_at), updated_at),
			progress = GREATEST(progress, VALUES(progress))`, args...).Error
}
