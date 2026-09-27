package storyteller

import (
	"fmt"
	"slices"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/plugin/dbresolver"
)

// 封存匯出與 MySQL 清除的讀取一律強制走 primary（dbresolver.Write）：replica 落後時，
// 可能漏掉還沒同步的事件，或讀到舊的匯出紀錄、把已匯出的月份當成沒匯出而覆蓋 S3 上的檔案。

// auditArchiveMarkChunk 是標記已封存時每次 UPDATE ... WHERE id IN (...) 的 id 數量上限。
const auditArchiveMarkChunk = 1000

// AuditEarliestEventTime 找出 MySQL 裡最早的稽核事件，匯出排程從這個月份開始檢查。
func (r *Repository) AuditEarliestEventTime() (*time.Time, error) {
	var row struct{ OccurredAt *time.Time }
	err := r.db.Clauses(dbresolver.Write).Model(&storytellerModel.AuditEvent{}).Select("MIN(occurred_at) AS occurred_at").Scan(&row).Error
	return row.OccurredAt, err
}

// AuditEventsForExport 以 (occurred_at, id) keyset 依序取出一個月份裡還沒封存（archived_at IS NULL）的事件；
// InnoDB 的 (occurred_at) 索引本身就帶著主鍵 id，這個排序可以直接走索引，不會每批都重排整個月。
func (r *Repository) AuditEventsForExport(from, to time.Time, afterAt *time.Time, afterID uint64, limit int) ([]storytellerModel.AuditEvent, error) {
	query := r.db.Clauses(dbresolver.Write).Where("occurred_at >= ? AND occurred_at < ? AND archived_at IS NULL", from, to)
	if afterAt != nil {
		query = query.Where("(occurred_at > ? OR (occurred_at = ? AND id > ?))", *afterAt, *afterAt, afterID)
	}
	rows := make([]storytellerModel.AuditEvent, 0, limit)
	err := query.Order("occurred_at ASC, id ASC").Limit(limit).Find(&rows).Error
	return rows, err
}

// CommitAuditExport 在同一個交易裡把這次實際寫進 S3 的事件標成已封存，並 upsert 月份的匯出紀錄。
// 標記的筆數必須等於匯出的筆數，否則整個 rollback、下次排程重試（S3 同名檔會被覆蓋）。
// 用「逐列標記」而不是 id 範圍，是因為交易的 commit 順序不一定等於 auto-increment 的順序。
func (r *Repository) CommitAuditExport(row *storytellerModel.AuditExport, eventIDs []uint64, archivedAt time.Time) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var marked int64
		for chunk := range slices.Chunk(eventIDs, auditArchiveMarkChunk) {
			result := tx.Exec("UPDATE storyteller_audit_events SET archived_at = ? WHERE id IN ? AND archived_at IS NULL", archivedAt, chunk)
			if result.Error != nil {
				return result.Error
			}
			marked += result.RowsAffected
		}
		if marked != int64(len(eventIDs)) {
			return fmt.Errorf("audit export %s marked %d of %d events", row.Month, marked, len(eventIDs))
		}
		return saveAuditExport(tx, row)
	})
}

// DeleteAuditEventsBetween 分批實體刪除某月份「已封存」的 MySQL 資料，避免一次刪整個月鎖太久。
// 稽核事件本來就是 append-only、沒有 soft delete 欄位；還沒封存的列（晚到的事件）留著等下次補匯。
func (r *Repository) DeleteAuditEventsBetween(from, to time.Time, limit int) (int64, error) {
	result := r.db.Exec("DELETE FROM storyteller_audit_events WHERE occurred_at >= ? AND occurred_at < ? AND archived_at IS NOT NULL ORDER BY occurred_at, id LIMIT ?", from, to, limit)
	return result.RowsAffected, result.Error
}

func (r *Repository) AuditExports() ([]storytellerModel.AuditExport, error) {
	rows := make([]storytellerModel.AuditExport, 0)
	err := r.db.Clauses(dbresolver.Write).Order("month ASC").Find(&rows).Error
	return rows, err
}

// SaveAuditExport 以月份為唯一鍵 upsert（匯出失敗時記錄 failed 用）。
func (r *Repository) SaveAuditExport(row *storytellerModel.AuditExport) error {
	return saveAuditExport(r.db, row)
}

// saveAuditExport 只更新匯出排程負責的欄位；兩個 purged_at 由清除排程以 SetAuditExportPurgedAt 單獨更新，
// 兩個排程撞在一起時才不會用舊資料把對方的結果蓋掉。
func saveAuditExport(db *gorm.DB, row *storytellerModel.AuditExport) error {
	return db.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "month"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"status", "row_count", "object_keys", "checksum", "retain_until", "error_message", "exported_at",
		}),
	}).Create(row).Error
}

// AuditExportPurgedColumn 限定 SetAuditExportPurgedAt 只能更新這兩個欄位。
type AuditExportPurgedColumn string

const (
	AuditExportMySQLPurged   AuditExportPurgedColumn = "mysql_purged_at"
	AuditExportArchivePurged AuditExportPurgedColumn = "archive_purged_at"
)

func (r *Repository) SetAuditExportPurgedAt(month string, column AuditExportPurgedColumn, at time.Time) error {
	return r.db.Model(&storytellerModel.AuditExport{}).Where("month = ?", month).Update(string(column), at).Error
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
