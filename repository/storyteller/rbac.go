package storyteller

import (
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// CreateProjectRole 建立一個掛在指定 Project 底下的角色；呼叫端負責先確認操作者是
// 該 Project 的 owner——角色／成員管理是 owner-only，repository 層不重複判斷授權。
func (r *Repository) CreateProjectRole(projectID uint64, name string, createdByUserID uint64) (*storytellerModel.Role, error) {
	role := &storytellerModel.Role{
		Name:            name,
		ScopeType:       storytellerModel.RoleScopeTypeProject,
		ProjectID:       &projectID,
		CreatedByUserID: createdByUserID,
	}
	if err := r.db.Create(role).Error; err != nil {
		return nil, err
	}
	return role, nil
}

// ProjectRoleByID 只回傳未停用、且屬於指定 Project 的角色，避免呼叫端誤用其他
// Project 或已停用的角色 ID。
func (r *Repository) ProjectRoleByID(projectID, roleID uint64) (*storytellerModel.Role, error) {
	var role storytellerModel.Role
	err := r.db.Where("id = ? AND project_id = ? AND disabled_at IS NULL", roleID, projectID).
		First(&role).Error
	if err != nil {
		return nil, err
	}
	return &role, nil
}

// SetRolePermissions 整批覆蓋一個角色目前的 permission 組合（先清空再重建），
// 避免呼叫端要自己算增量的 diff。permissionKeys 為空代表把角色清成沒有任何權限，
// 不是「不修改」。
func (r *Repository) SetRolePermissions(roleID uint64, permissionKeys []storytellerModel.PermissionKey) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("role_id = ?", roleID).Delete(&storytellerModel.RolePermission{}).Error; err != nil {
			return err
		}
		if len(permissionKeys) == 0 {
			return nil
		}
		var permissions []storytellerModel.Permission
		if err := tx.Where("key IN ?", permissionKeys).Find(&permissions).Error; err != nil {
			return err
		}
		rows := make([]storytellerModel.RolePermission, 0, len(permissions))
		for _, permission := range permissions {
			rows = append(rows, storytellerModel.RolePermission{RoleID: roleID, PermissionID: permission.ID})
		}
		if len(rows) == 0 {
			return nil
		}
		return tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&rows).Error
	})
}

// GrantUserRole 讓 userID 在 [startsAt, expiresAt) 期間持有 roleID；expiresAt 為
// nil 代表沒有到期時間，需要靠明確 RevokeUserRole 才會失效。
func (r *Repository) GrantUserRole(roleID, userID, grantedByUserID uint64, startsAt time.Time, expiresAt *time.Time) (*storytellerModel.UserRole, error) {
	grant := &storytellerModel.UserRole{
		RoleID:          roleID,
		UserID:          userID,
		StartsAt:        startsAt,
		ExpiresAt:       expiresAt,
		GrantedByUserID: grantedByUserID,
	}
	if err := r.db.Create(grant).Error; err != nil {
		return nil, err
	}
	return grant, nil
}

// RevokeUserRole 標記一筆 grant 為已撤銷；已經撤銷過的不會被覆寫成新的撤銷時間／人。
func (r *Repository) RevokeUserRole(userRoleID, revokedByUserID uint64) error {
	now := time.Now()
	return r.db.Model(&storytellerModel.UserRole{}).
		Where("id = ? AND revoked_at IS NULL", userRoleID).
		Updates(map[string]any{
			"revoked_at":         now,
			"revoked_by_user_id": revokedByUserID,
		}).Error
}

// EffectivePermissionKeys 回傳 userID 在 projectID「此刻」透過有效角色取得的權限
// key 集合（已去重）。不包含 owner 隱含的 default_user 權限——owner 判斷與這份
// 集合取聯集由 service 層負責，repository 只管「角色授予了什麼」。
func (r *Repository) EffectivePermissionKeys(userID, projectID uint64) ([]storytellerModel.PermissionKey, error) {
	var keys []storytellerModel.PermissionKey
	now := time.Now()
	err := r.db.
		Table("storyteller_user_roles AS ur").
		Joins("JOIN storyteller_roles AS role ON role.id = ur.role_id AND role.disabled_at IS NULL").
		Joins("JOIN storyteller_role_permissions AS rp ON rp.role_id = role.id").
		Joins("JOIN storyteller_permissions AS p ON p.id = rp.permission_id").
		Where("ur.user_id = ?", userID).
		Where("role.scope_type = ?", storytellerModel.RoleScopeTypeProject).
		Where("role.project_id = ?", projectID).
		Where("ur.revoked_at IS NULL").
		Where("ur.starts_at <= ?", now).
		Where("ur.expires_at IS NULL OR ur.expires_at > ?", now).
		Distinct("p.key").
		Pluck("p.key", &keys).Error
	return keys, err
}

// CreateProjectAudit 寫入一筆 Project 異動事件；append-only，呼叫端不應該修改或
// 刪除既有紀錄。
func (r *Repository) CreateProjectAudit(audit *storytellerModel.ProjectAudit) error {
	if audit.OccurredAt.IsZero() {
		audit.OccurredAt = time.Now()
	}
	return r.db.Create(audit).Error
}

// ProjectAudits 依時間新到舊列出指定 Project 的異動紀錄，供 owner 查詢用。
func (r *Repository) ProjectAudits(projectID uint64, page, pageSize int) ([]storytellerModel.ProjectAudit, error) {
	rows := make([]storytellerModel.ProjectAudit, 0)
	err := r.db.Where("project_id = ?", projectID).
		Order("occurred_at DESC, id DESC").
		Offset((page - 1) * pageSize).
		Limit(pageSize).
		Find(&rows).Error
	return rows, err
}
