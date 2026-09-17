package storyteller

import (
	"errors"
	"strconv"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
	"gorm.io/plugin/dbresolver"
)

// ErrUnknownPermissionKey 代表呼叫端傳入了不存在、或跟目標角色 scope 不符的
// permission key——寧可整批拒絕，也不要靜默丟掉打錯或越界的 key。
var ErrUnknownPermissionKey = errors.New("storyteller: unknown or scope-mismatched permission key")

// ErrInvalidRoleGrantWindow 代表 expires_at 沒有晚於 starts_at，這種 grant 一建立
// 就已經失效，多半是呼叫端算錯時間，直接拒絕比默默建立一筆永遠無效的紀錄好。
var ErrInvalidRoleGrantWindow = errors.New("storyteller: expires_at must be after starts_at")

// ErrUserRoleNotFound 代表指定的 grant 不存在、已經撤銷過，或不屬於呼叫端指定的
// 角色——後者是刻意的防護，避免 A 專案的 owner 用 A 的合法 role_id 撤銷 B 專案底下
// 的 grant（cross-project revoke）。
var ErrUserRoleNotFound = errors.New("storyteller: user role grant not found or already revoked")

// CreateProjectRole 建立一個掛在指定 Project 底下的角色，並在同一個 transaction
// 內寫入對應的 audit 紀錄——異動與稽核要嘛一起成功、要嘛一起失敗，不會出現「角色
// 建立了但沒有留下紀錄」的情況。呼叫端負責先確認操作者是該 Project 的
// owner——角色／成員管理是 owner-only，repository 層不重複判斷授權。
func (r *Repository) CreateProjectRole(
	projectID uint64,
	name string,
	createdByUserID uint64,
	source storytellerModel.ProjectAuditSource,
	requestID string,
) (*storytellerModel.Role, error) {
	role := &storytellerModel.Role{
		Name:            name,
		ScopeType:       storytellerModel.RoleScopeTypeProject,
		ProjectID:       &projectID,
		CreatedByUserID: createdByUserID,
	}
	err := r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(role).Error; err != nil {
			return err
		}
		return tx.Create(&storytellerModel.ProjectAudit{
			ProjectID:   projectID,
			ActorUserID: createdByUserID,
			Source:      source,
			Action:      "role.create",
			TargetType:  "role",
			TargetID:    strconv.FormatUint(role.ID, 10),
			Summary:     storytellerModel.ProjectAuditSummary{"name": role.Name},
			RequestID:   requestID,
			OccurredAt:  time.Now(),
		}).Error
	})
	if err != nil {
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

// uniquePermissionKeys 去除重複 key，同時保留穩定順序方便比對數量。
func uniquePermissionKeys(keys []storytellerModel.PermissionKey) []storytellerModel.PermissionKey {
	seen := make(map[storytellerModel.PermissionKey]bool, len(keys))
	unique := make([]storytellerModel.PermissionKey, 0, len(keys))
	for _, key := range keys {
		if seen[key] {
			continue
		}
		seen[key] = true
		unique = append(unique, key)
	}
	return unique
}

// SetRolePermissions 整批覆蓋一個角色目前的 permission 組合（先清空再重建），並在
// 同一個 transaction 內寫入 audit。permissionKeys 為空代表把角色清成沒有任何權限，
// 不是「不修改」。任何一個 key 不存在、或 scope_type 跟角色不符，整批拒絕並回傳
// ErrUnknownPermissionKey，不會把有效的 key 設上去、無效的悄悄丟掉。
func (r *Repository) SetRolePermissions(
	role *storytellerModel.Role,
	permissionKeys []storytellerModel.PermissionKey,
	actorUserID uint64,
	source storytellerModel.ProjectAuditSource,
	requestID string,
) error {
	uniqueKeys := uniquePermissionKeys(permissionKeys)
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("role_id = ?", role.ID).Delete(&storytellerModel.RolePermission{}).Error; err != nil {
			return err
		}
		if len(uniqueKeys) > 0 {
			var permissions []storytellerModel.Permission
			if err := tx.Where("`key` IN ? AND scope_type = ?", uniqueKeys, role.ScopeType).
				Find(&permissions).Error; err != nil {
				return err
			}
			if len(permissions) != len(uniqueKeys) {
				return ErrUnknownPermissionKey
			}
			rows := make([]storytellerModel.RolePermission, 0, len(permissions))
			for _, permission := range permissions {
				rows = append(rows, storytellerModel.RolePermission{RoleID: role.ID, PermissionID: permission.ID})
			}
			if err := tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&rows).Error; err != nil {
				return err
			}
		}
		return tx.Create(&storytellerModel.ProjectAudit{
			ProjectID:   *role.ProjectID,
			ActorUserID: actorUserID,
			Source:      source,
			Action:      "role.set_permissions",
			TargetType:  "role",
			TargetID:    strconv.FormatUint(role.ID, 10),
			Summary:     storytellerModel.ProjectAuditSummary{"permission_keys": uniqueKeys},
			RequestID:   requestID,
			OccurredAt:  time.Now(),
		}).Error
	})
}

// GrantUserRole 讓 memberUserID 在 [startsAt, expiresAt) 期間持有 role，並在同一個
// transaction 內寫入 audit。expiresAt 為 nil 代表沒有到期時間，需要靠明確
// RevokeUserRole 才會失效；expiresAt 沒有晚於 startsAt 時拒絕，避免建立一筆
// 生下來就已經過期的 grant。
func (r *Repository) GrantUserRole(
	role *storytellerModel.Role,
	memberUserID, grantedByUserID uint64,
	startsAt time.Time,
	expiresAt *time.Time,
	source storytellerModel.ProjectAuditSource,
	requestID string,
) (*storytellerModel.UserRole, error) {
	if expiresAt != nil && !expiresAt.After(startsAt) {
		return nil, ErrInvalidRoleGrantWindow
	}
	grant := &storytellerModel.UserRole{
		RoleID:          role.ID,
		UserID:          memberUserID,
		StartsAt:        startsAt,
		ExpiresAt:       expiresAt,
		GrantedByUserID: grantedByUserID,
	}
	err := r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(grant).Error; err != nil {
			return err
		}
		return tx.Create(&storytellerModel.ProjectAudit{
			ProjectID:   *role.ProjectID,
			ActorUserID: grantedByUserID,
			Source:      source,
			Action:      "role.grant",
			TargetType:  "user_role",
			TargetID:    strconv.FormatUint(grant.ID, 10),
			Summary:     storytellerModel.ProjectAuditSummary{"role_id": role.ID, "member_user_id": memberUserID},
			RequestID:   requestID,
			OccurredAt:  time.Now(),
		}).Error
	})
	if err != nil {
		return nil, err
	}
	return grant, nil
}

// RevokeUserRole 標記一筆 grant 為已撤銷，並在同一個 transaction 內寫入 audit。
// UPDATE 條件同時鎖定 role.ID，不只鎖定 userRoleID——這是防止 cross-project
// revoke 的關鍵：呼叫端已經用 ProjectRoleByID(projectID, roleID) 確認過 role
// 屬於自己的 Project，這裡再用 role_id = role.ID 確保目標 grant 真的掛在這個
// role 下，A 專案 owner 才不能拿 A 的合法 role_id、userRoleID 猜中 B 專案底下的
// grant 就撤銷掉。RowsAffected 為 0（grant 不存在、已撤銷、或 role_id 不符）一律
// 回傳 ErrUserRoleNotFound。
func (r *Repository) RevokeUserRole(
	role *storytellerModel.Role,
	userRoleID, revokedByUserID uint64,
	source storytellerModel.ProjectAuditSource,
	requestID string,
) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		result := tx.Model(&storytellerModel.UserRole{}).
			Where("id = ? AND role_id = ? AND revoked_at IS NULL", userRoleID, role.ID).
			Updates(map[string]any{
				"revoked_at":         now,
				"revoked_by_user_id": revokedByUserID,
			})
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected == 0 {
			return ErrUserRoleNotFound
		}
		return tx.Create(&storytellerModel.ProjectAudit{
			ProjectID:   *role.ProjectID,
			ActorUserID: revokedByUserID,
			Source:      source,
			Action:      "role.revoke",
			TargetType:  "user_role",
			TargetID:    strconv.FormatUint(userRoleID, 10),
			RequestID:   requestID,
			OccurredAt:  now,
		}).Error
	})
}

// EffectivePermissionKeys 回傳 userID 在 projectID「此刻」透過有效角色取得的權限
// key 集合（已去重）。不包含 owner 隱含的 default_user 權限——owner 判斷與這份
// 集合取聯集由 service 層負責，repository 只管「角色授予了什麼」。
//
// 強制走 primary（dbresolver.Write）：這是撤銷／權限異動後必須立即生效的授權判斷
// 查詢，不能容許 replica lag 期間仍讀到已撤銷或已移除的授權，即使一般讀取查詢會
// 被 dbresolver 自動導去唯讀複本。
func (r *Repository) EffectivePermissionKeys(userID, projectID uint64) ([]storytellerModel.PermissionKey, error) {
	var keys []storytellerModel.PermissionKey
	now := time.Now()
	err := r.db.Clauses(dbresolver.Write).
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
		Distinct("p.`key`").
		Pluck("p.`key`", &keys).Error
	return keys, err
}

// CreateProjectAudit 寫入一筆 Project 異動事件；append-only，呼叫端不應該修改或
// 刪除既有紀錄。角色／成員管理的異動改由對應方法在同一個 transaction 內直接寫，
// 這支只留給沒有專屬 repository 方法、需要單獨補寫 audit 的呼叫端使用。
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
