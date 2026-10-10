package storyteller

import (
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"gorm.io/gorm"
	"gorm.io/plugin/dbresolver"
)

// 管理後台：平台權限、檢舉聚合查詢、站方處置。後台讀取一律包含已刪除的資料（要能看到處置後的狀態）。

// EffectivePlatformPermissionKeys 是 userID「此刻」透過平台角色取得的權限。
// 跟 EffectivePermissionKeys 一樣強制走 primary：撤銷角色後下一個請求就要失效。
func (r *Repository) EffectivePlatformPermissionKeys(userID uint64) ([]storytellerModel.PermissionKey, error) {
	var keys []storytellerModel.PermissionKey
	now := time.Now()
	err := r.db.Clauses(dbresolver.Write).
		Table("storyteller_user_roles AS ur").
		Joins("JOIN storyteller_roles AS role ON role.id = ur.role_id AND role.disabled_at IS NULL").
		Joins("JOIN storyteller_role_permissions AS rp ON rp.role_id = role.id").
		Joins("JOIN storyteller_permissions AS p ON p.id = rp.permission_id AND p.scope_type = ?", storytellerModel.RoleScopeTypePlatform).
		Where("ur.user_id = ?", userID).
		Where("role.scope_type = ? AND role.project_id IS NULL", storytellerModel.RoleScopeTypePlatform).
		Where("ur.revoked_at IS NULL AND ur.starts_at <= ?", now).
		Where("ur.expires_at IS NULL OR ur.expires_at > ?", now).
		Distinct("p.`key`").
		Pluck("p.`key`", &keys).Error
	return keys, err
}

// AdminReportGroupRow 是檢舉以「對象」聚合後的一列。
type AdminReportGroupRow struct {
	TargetType     storytellerModel.ReportTargetType
	TargetID       uint64
	Count          int64
	LastReportedAt time.Time
	LastHandledAt  *time.Time
}

// reportTargetTypes 把篩選用的 author 展開成 user／author_profile。
func reportTargetTypes(filter storytellerModel.ReportTargetType) []storytellerModel.ReportTargetType {
	if filter == storytellerModel.ReportTargetAuthor {
		return []storytellerModel.ReportTargetType{storytellerModel.ReportTargetUser, storytellerModel.ReportTargetAuthorProfile}
	}
	return []storytellerModel.ReportTargetType{filter}
}

// AdminReportGroups 依狀態列出被檢舉的對象：待處理依「該狀態的檢舉數多→少、最後被檢舉新→舊」排序，
// 已結案／已駁回依處理時間新→舊。
func (r *Repository) AdminReportGroups(status storytellerModel.ReportStatus, filter storytellerModel.ReportTargetType, offset, limit int) ([]AdminReportGroupRow, int64, error) {
	query := r.db.Model(&storytellerModel.Report{}).Where("status = ?", status)
	if filter != "" {
		query = query.Where("target_type IN ?", reportTargetTypes(filter))
	}
	query = query.Group("target_type, target_id")
	var total int64
	if err := r.db.Table("(?) AS t", query.Session(&gorm.Session{}).Select("1")).Count(&total).Error; err != nil {
		return nil, 0, err
	}
	order := "count DESC, last_reported_at DESC"
	if status != storytellerModel.ReportStatusPending {
		order = "last_handled_at DESC, last_reported_at DESC"
	}
	rows := make([]AdminReportGroupRow, 0)
	err := query.Select("target_type, target_id, COUNT(*) AS count, MAX(created_at) AS last_reported_at, MAX(handled_at) AS last_handled_at").
		Order(order).Offset(offset).Limit(limit).Scan(&rows).Error
	return rows, total, err
}

// AdminReportStatusCounts 是各狀態有多少個不同的對象（分頁 tab 上的數字）。
func (r *Repository) AdminReportStatusCounts() (map[storytellerModel.ReportStatus]int64, error) {
	var rows []struct {
		Status storytellerModel.ReportStatus
		Count  int64
	}
	err := r.db.Model(&storytellerModel.Report{}).Select("status, COUNT(DISTINCT target_type, target_id) AS count").Group("status").Scan(&rows).Error
	counts := make(map[storytellerModel.ReportStatus]int64, len(rows))
	for _, row := range rows {
		counts[row.Status] = row.Count
	}
	return counts, err
}

// ReportsByTarget 是某個對象的所有檢舉（新到舊）。
func (r *Repository) ReportsByTarget(targetType storytellerModel.ReportTargetType, targetID uint64) ([]storytellerModel.Report, error) {
	rows := make([]storytellerModel.Report, 0)
	err := r.db.Where("target_type = ? AND target_id = ?", targetType, targetID).Order("id DESC").Find(&rows).Error
	return rows, err
}

// ReportsByTargetStatus 是某個對象在某狀態下的檢舉，列表用來算原因統計。
func (r *Repository) ReportsByTargetStatus(targetType storytellerModel.ReportTargetType, targetID uint64, status storytellerModel.ReportStatus) ([]storytellerModel.Report, error) {
	rows := make([]storytellerModel.Report, 0)
	err := r.db.Where("target_type = ? AND target_id = ? AND status = ?", targetType, targetID, status).Find(&rows).Error
	return rows, err
}

// HandlePendingReports 把對象底下所有 pending 檢舉改成 resolved／dismissed；以 status = pending 為條件，
// 兩位管理員同時處理時後到的只會更新到剩下的（或 0 筆）。
func (r *Repository) HandlePendingReports(targetType storytellerModel.ReportTargetType, targetID uint64, status storytellerModel.ReportStatus, handlerID uint64) (int64, error) {
	result := r.db.Model(&storytellerModel.Report{}).
		Where("target_type = ? AND target_id = ? AND status = ?", targetType, targetID, storytellerModel.ReportStatusPending).
		Updates(map[string]any{"status": status, "handled_by_user_id": handlerID, "handled_at": time.Now()})
	return result.RowsAffected, result.Error
}

// AdminRowByID 取任一種內容表的一列（含已刪除），後台組對象摘要用。
func AdminRowByID[T any](r *Repository, id uint64) (*T, error) {
	var row T
	err := r.db.Where("id = ?", id).First(&row).Error
	return &row, err
}

// AdminIDByPublicID 把後台網址上的 public_id 換回內部 id（含已刪除的列）。
func (r *Repository) AdminIDByPublicID(model any, publicID string) (uint64, error) {
	var row struct{ ID uint64 }
	err := r.db.Model(model).Select("id").Where("public_id = ?", publicID).Take(&row).Error
	return row.ID, err
}

// SetDeleteReason 在 soft delete 之前寫入站方處置理由；只寫還沒被刪除的列，不覆寫作者自行刪除的狀態。
func (r *Repository) SetDeleteReason(model any, id uint64, reason string) error {
	return r.db.Model(model).Where("id = ? AND is_deleted = 0", id).Update("delete_reason", reason).Error
}

// BanUser 停權帳號：is_deleted＋delete_reason（站方停權一定帶理由，跟本人刪帳號區分）。
func (r *Repository) BanUser(userID uint64, reason string) error {
	return r.db.Model(&storytellerModel.UserProfile{}).Where("id = ? AND is_deleted = 0", userID).
		Updates(map[string]any{"is_deleted": true, "deleted_at": time.Now(), "delete_reason": reason}).Error
}

// UserBanned 判斷帳號是否已被站方停權（is_deleted 且有理由；本人刪帳號不算）。走 primary，停權後立即生效。
func (r *Repository) UserBanned(userID uint64) (bool, error) {
	var count int64
	err := r.db.Clauses(dbresolver.Write).Model(&storytellerModel.UserProfile{}).
		Where("id = ? AND is_deleted = 1 AND delete_reason IS NOT NULL", userID).Count(&count).Error
	return count > 0, err
}

// AdminFootprint 是帳號（profileID 為 nil 時含所有身份）或單一筆名目前公開的足跡數量。
func (r *Repository) AdminFootprint(userID uint64, profileID *uint64) (storytellerModel.AdminFootprint, error) {
	var out storytellerModel.AdminFootprint
	count := func(model any, dest *int64) error {
		query := r.db.Model(model).Where("user_id = ? AND is_deleted = 0", userID)
		if profileID != nil {
			query = query.Where("profile_id = ?", *profileID)
		}
		return query.Count(dest).Error
	}
	if profileID == nil {
		if err := r.db.Model(&storytellerModel.Project{}).Where("user_id = ? AND is_deleted = 0", userID).Count(&out.Projects).Error; err != nil {
			return out, err
		}
	}
	for _, item := range []struct {
		model any
		dest  *int64
	}{{&storytellerModel.AuthorPost{}, &out.Posts}, {&storytellerModel.DiscussionThread{}, &out.Threads}, {&storytellerModel.Comment{}, &out.Comments}} {
		if err := count(item.model, item.dest); err != nil {
			return out, err
		}
	}
	return out, nil
}

// LiveAuthorProfilesByUser 是帳號目前未刪除的額外筆名。
func (r *Repository) LiveAuthorProfilesByUser(userID uint64) ([]storytellerModel.AuthorProfile, error) {
	rows := make([]storytellerModel.AuthorProfile, 0)
	err := r.db.Where("user_id = ? AND is_deleted = 0", userID).Order("id ASC").Find(&rows).Error
	return rows, err
}
