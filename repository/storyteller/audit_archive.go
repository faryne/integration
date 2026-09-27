package storyteller

import (
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"gorm.io/gorm/clause"
	"gorm.io/plugin/dbresolver"
)

// 封存匯出與 MySQL 清除的讀取一律強制走 primary（dbresolver.Write）：
// replica 落後時匯出與筆數會一起少算、比對仍然相等，之後 primary 刪除就會丟掉沒匯出的事件。

// AuditEarliestEventTime 找出 MySQL 裡最早的稽核事件，匯出排程從這個月份開始補齊還沒匯出的月份。
func (r *Repository) AuditEarliestEventTime() (*time.Time, error) {
	var row struct{ OccurredAt *time.Time }
	err := r.db.Clauses(dbresolver.Write).Model(&storytellerModel.AuditEvent{}).Select("MIN(occurred_at) AS occurred_at").Scan(&row).Error
	return row.OccurredAt, err
}

// AuditEventsForExport 以 (occurred_at, id) keyset 依序取出一個月份裡 id > watermark 的事件；
// InnoDB 的 (occurred_at) 索引本身就帶著主鍵 id，這個排序可以直接走索引，不會每批都重排整個月。
// watermark 是上次匯出涵蓋到的最大 id，首次匯出為 0；auto-increment 單調遞增，晚到的事件 id 一定更大。
func (r *Repository) AuditEventsForExport(from, to time.Time, watermark uint64, afterAt *time.Time, afterID uint64, limit int) ([]storytellerModel.AuditEvent, error) {
	query := r.db.Clauses(dbresolver.Write).Where("occurred_at >= ? AND occurred_at < ? AND id > ?", from, to, watermark)
	if afterAt != nil {
		query = query.Where("(occurred_at > ? OR (occurred_at = ? AND id > ?))", *afterAt, *afterAt, afterID)
	}
	rows := make([]storytellerModel.AuditEvent, 0, limit)
	err := query.Order("occurred_at ASC, id ASC").Limit(limit).Find(&rows).Error
	return rows, err
}

func (r *Repository) AuditEventCountBetween(from, to time.Time, watermark uint64) (int64, error) {
	var count int64
	err := r.db.Clauses(dbresolver.Write).Model(&storytellerModel.AuditEvent{}).
		Where("occurred_at >= ? AND occurred_at < ? AND id > ?", from, to, watermark).Count(&count).Error
	return count, err
}

// DeleteAuditEventsBetween 分批實體刪除已封存月份的 MySQL 資料，避免一次刪整個月鎖太久。
// 稽核事件本來就是 append-only、沒有 soft delete 欄位；只刪 id <= maxID（匯出涵蓋到的範圍），
// 匯出後才晚到的事件留著等下次補匯。
func (r *Repository) DeleteAuditEventsBetween(from, to time.Time, maxID uint64, limit int) (int64, error) {
	result := r.db.Exec("DELETE FROM storyteller_audit_events WHERE occurred_at >= ? AND occurred_at < ? AND id <= ? ORDER BY occurred_at, id LIMIT ?", from, to, maxID, limit)
	return result.RowsAffected, result.Error
}

func (r *Repository) AuditExports() ([]storytellerModel.AuditExport, error) {
	rows := make([]storytellerModel.AuditExport, 0)
	err := r.db.Order("month ASC").Find(&rows).Error
	return rows, err
}

// SaveAuditExport 以月份為唯一鍵 upsert；匯出重跑時覆蓋同一個月份的紀錄。
func (r *Repository) SaveAuditExport(row *storytellerModel.AuditExport) error {
	return r.db.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "month"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"status", "row_count", "max_event_id", "object_keys", "checksum", "retain_until", "error_message",
			"exported_at", "mysql_purged_at", "archive_purged_at",
		}),
	}).Create(row).Error
}

func (r *Repository) CreateAuditArchiveQuery(row *storytellerModel.AuditArchiveQuery) error {
	return r.db.Create(row).Error
}

// AuditArchiveQueryByPublicID 一律帶 user_id，只有建立 job 的使用者拿得到。
func (r *Repository) AuditArchiveQueryByPublicID(userID uint64, publicID string) (*storytellerModel.AuditArchiveQuery, error) {
	var row storytellerModel.AuditArchiveQuery
	err := r.db.Where("user_id = ? AND public_id = ?", userID, publicID).First(&row).Error
	return &row, err
}

func (r *Repository) SaveAuditArchiveQuery(row *storytellerModel.AuditArchiveQuery) error {
	return r.db.Save(row).Error
}
