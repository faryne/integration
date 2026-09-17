package storyteller

import (
	"errors"
	"strings"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

// ErrRoleManagementOwnerOnly 代表呼叫者不是該 Project 的 owner，因此不能建立角色、
// 調整權限或授予／撤銷成員。第一批角色／成員管理永遠是 owner-only，不因協作者持有
// 任何 resource permission 而放行——這條路徑本身就不存在，見
// DevelopDocuments/storyteller/想要做的東西.md「不做範圍與待討論」。
var ErrRoleManagementOwnerOnly = errors.New("storyteller: role management is owner-only")

const roleNameMaxLength = 255

// validateProjectRoleName 比照 validateProject 系列的驗證慣例：trim、非空、長度
// 上限跟 DB 欄位一致。放在 service 層做，不推給呼叫端各自驗證。
func validateProjectRoleName(name string) (string, error) {
	trimmed := strings.TrimSpace(name)
	if trimmed == "" {
		return "", errors.New("role name is required")
	}
	if len(trimmed) > roleNameMaxLength {
		return "", errors.New("role name is too long")
	}
	return trimmed, nil
}

// ProjectAuthorization 是某個使用者在某個 Project 當下的有效授權快照。Owner 隱含
// default_user 角色，等同擁有這個 Project 底下的所有 resource permission；非
// owner 只取得透過目前有效角色授予的 permission（已套用推導規則後的集合），
// 兩者不互相推導。
type ProjectAuthorization struct {
	IsOwner     bool
	Permissions map[storytellerModel.PermissionKey]bool
}

// Has 判斷這份授權快照是否涵蓋指定 permission；owner 永遠回傳 true。非 owner 的
// Permissions 已經在 ProjectAuthorizationFor 組成時套用過 derivePermissions，這裡
// 只需要單純查表，不重複做推導。
func (a ProjectAuthorization) Has(key storytellerModel.PermissionKey) bool {
	if a.IsOwner {
		return true
	}
	return a.Permissions[key]
}

// derivePermissions 依「想要做的東西.md」定義的推導規則展開角色實際授予的 key：
//
//  1. 任一資源的 create／update 都有效包含同一資源的 read（`story.update` ⇒
//     `story.read`），不需要角色重複儲存 read。
//  2. 持有任一非 project 資源的 permission 時，隱含 project.read（協作專案列表
//     與工作台導覽用的 Project 安全摘要）；project.update 本身走規則 1 也會推導出
//     project.read，這裡不用特別處理。
//
// 展開後的集合才是最終判斷依據，Has() 不再重複做這層推導。
func derivePermissions(granted map[storytellerModel.PermissionKey]bool) map[storytellerModel.PermissionKey]bool {
	derived := make(map[storytellerModel.PermissionKey]bool, len(granted))
	hasNonProjectPermission := false
	for key, ok := range granted {
		if !ok {
			continue
		}
		derived[key] = true
		resource, action, found := strings.Cut(string(key), ".")
		if !found {
			continue
		}
		if resource != "project" {
			hasNonProjectPermission = true
		}
		if action == "create" || action == "update" {
			derived[storytellerModel.PermissionKey(resource+".read")] = true
		}
	}
	if hasNonProjectPermission {
		derived[storytellerModel.PermissionProjectRead] = true
	}
	return derived
}

// ProjectAuthorizationFor 組出 userID 在 projectID 底下的有效授權快照。owner 判斷
// 直接比對 Project.UserID，跟現有 ProjectByPublicIDForUser 系列查詢用的是同一份
// 事實來源，不另外維護一份「誰是 owner」的資料。
func (s *Service) ProjectAuthorizationFor(userID, projectID uint64) (ProjectAuthorization, error) {
	project, err := s.repo.ProjectByID(projectID)
	if err != nil {
		return ProjectAuthorization{}, err
	}
	if project.UserID == userID {
		return ProjectAuthorization{IsOwner: true}, nil
	}
	keys, err := s.repo.EffectivePermissionKeys(userID, projectID)
	if err != nil {
		return ProjectAuthorization{}, err
	}
	granted := make(map[storytellerModel.PermissionKey]bool, len(keys))
	for _, key := range keys {
		granted[key] = true
	}
	return ProjectAuthorization{Permissions: derivePermissions(granted)}, nil
}

// HasProjectPermission 是 ProjectAuthorizationFor 接一次 Has() 判斷的捷徑，給只
// 需要單一布林結果、不需要整份快照（例如給前端算 capability 列表）的呼叫端用。
func (s *Service) HasProjectPermission(userID, projectID uint64, key storytellerModel.PermissionKey) (bool, error) {
	authorization, err := s.ProjectAuthorizationFor(userID, projectID)
	if err != nil {
		return false, err
	}
	return authorization.Has(key), nil
}

// projectOwnerOnly 是四個角色／成員管理方法共用的前置檢查：取出 Project、確認
// actorUserID 是 owner，不是的話回傳 ErrRoleManagementOwnerOnly。
func (s *Service) projectOwnerOnly(actorUserID, projectID uint64) (*storytellerModel.Project, error) {
	project, err := s.repo.ProjectByID(projectID)
	if err != nil {
		return nil, err
	}
	if project.UserID != actorUserID {
		return nil, ErrRoleManagementOwnerOnly
	}
	return project, nil
}

// CreateProjectRole 只有 Project owner 能呼叫。
func (s *Service) CreateProjectRole(
	actorUserID, projectID uint64,
	roleName string,
	source storytellerModel.ProjectAuditSource,
	requestID string,
) (*storytellerModel.Role, error) {
	if _, err := s.projectOwnerOnly(actorUserID, projectID); err != nil {
		return nil, err
	}
	name, err := validateProjectRoleName(roleName)
	if err != nil {
		return nil, err
	}
	return s.repo.CreateProjectRole(projectID, name, actorUserID, source, requestID)
}

// SetProjectRolePermissions 只有 Project owner 能呼叫，整批覆蓋指定角色目前的
// permission 組合。
func (s *Service) SetProjectRolePermissions(
	actorUserID, projectID, roleID uint64,
	keys []storytellerModel.PermissionKey,
	source storytellerModel.ProjectAuditSource,
	requestID string,
) error {
	if _, err := s.projectOwnerOnly(actorUserID, projectID); err != nil {
		return err
	}
	role, err := s.repo.ProjectRoleByID(projectID, roleID)
	if err != nil {
		return err
	}
	return s.repo.SetRolePermissions(role, keys, actorUserID, source, requestID)
}

// GrantProjectRole 只有 Project owner 能呼叫，把 roleID 授予 memberUserID。
// expiresAt 為 nil 代表沒有到期時間，需要之後明確 RevokeProjectRole 才會失效。
func (s *Service) GrantProjectRole(
	actorUserID, projectID, roleID, memberUserID uint64,
	expiresAt *time.Time,
	source storytellerModel.ProjectAuditSource,
	requestID string,
) (*storytellerModel.UserRole, error) {
	if _, err := s.projectOwnerOnly(actorUserID, projectID); err != nil {
		return nil, err
	}
	role, err := s.repo.ProjectRoleByID(projectID, roleID)
	if err != nil {
		return nil, err
	}
	return s.repo.GrantUserRole(role, memberUserID, actorUserID, time.Now(), expiresAt, source, requestID)
}

// RevokeProjectRole 只有 Project owner 能呼叫；userRoleID 是否真的屬於 roleID 由
// repository.RevokeUserRole 在同一個 UPDATE 條件裡鎖定，防止 owner 拿自己
// Project 底下的合法 roleID 去撤銷別的 Project 底下的 grant。
func (s *Service) RevokeProjectRole(
	actorUserID, projectID, roleID, userRoleID uint64,
	source storytellerModel.ProjectAuditSource,
	requestID string,
) error {
	if _, err := s.projectOwnerOnly(actorUserID, projectID); err != nil {
		return err
	}
	role, err := s.repo.ProjectRoleByID(projectID, roleID)
	if err != nil {
		return err
	}
	return s.repo.RevokeUserRole(role, userRoleID, actorUserID, source, requestID)
}
