package storyteller

import (
	"errors"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

// ErrRoleManagementOwnerOnly 代表呼叫者不是該 Project 的 owner，因此不能建立角色、
// 調整權限或授予／撤銷成員。第一批角色／成員管理永遠是 owner-only，不因協作者持有
// 任何 resource permission 而放行——這條路徑本身就不存在，見
// DevelopDocuments/storyteller/想要做的東西.md「不做範圍與待討論」。
var ErrRoleManagementOwnerOnly = errors.New("storyteller: role management is owner-only")

// ProjectAuthorization 是某個使用者在某個 Project 當下的有效授權快照。Owner 隱含
// default_user 角色，等同擁有這個 Project 底下的所有 resource permission；非
// owner 只取得透過目前有效角色授予的 permission 聯集，兩者不互相推導。
type ProjectAuthorization struct {
	IsOwner     bool
	Permissions map[storytellerModel.PermissionKey]bool
}

// Has 判斷這份授權快照是否涵蓋指定 permission；owner 永遠回傳 true。
func (a ProjectAuthorization) Has(key storytellerModel.PermissionKey) bool {
	if a.IsOwner {
		return true
	}
	return a.Permissions[key]
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
	permissions := make(map[storytellerModel.PermissionKey]bool, len(keys))
	for _, key := range keys {
		permissions[key] = true
	}
	return ProjectAuthorization{Permissions: permissions}, nil
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

// CreateProjectRole 只有 Project owner 能呼叫；roleName 由呼叫端先做基本驗證
// （非空、長度上限等），這裡不重複那層輸入驗證。
func (s *Service) CreateProjectRole(actorUserID, projectID uint64, roleName string) (*storytellerModel.Role, error) {
	project, err := s.repo.ProjectByID(projectID)
	if err != nil {
		return nil, err
	}
	if project.UserID != actorUserID {
		return nil, ErrRoleManagementOwnerOnly
	}
	return s.repo.CreateProjectRole(projectID, roleName, actorUserID)
}

// SetProjectRolePermissions 只有 Project owner 能呼叫，整批覆蓋指定角色目前的
// permission 組合。
func (s *Service) SetProjectRolePermissions(actorUserID, projectID, roleID uint64, keys []storytellerModel.PermissionKey) error {
	project, err := s.repo.ProjectByID(projectID)
	if err != nil {
		return err
	}
	if project.UserID != actorUserID {
		return ErrRoleManagementOwnerOnly
	}
	if _, err := s.repo.ProjectRoleByID(projectID, roleID); err != nil {
		return err
	}
	return s.repo.SetRolePermissions(roleID, keys)
}

// GrantProjectRole 只有 Project owner 能呼叫，把 roleID 授予 memberUserID。
// expiresAt 為 nil 代表沒有到期時間，需要之後明確 RevokeProjectRole 才會失效。
func (s *Service) GrantProjectRole(actorUserID, projectID, roleID, memberUserID uint64, expiresAt *time.Time) (*storytellerModel.UserRole, error) {
	project, err := s.repo.ProjectByID(projectID)
	if err != nil {
		return nil, err
	}
	if project.UserID != actorUserID {
		return nil, ErrRoleManagementOwnerOnly
	}
	if _, err := s.repo.ProjectRoleByID(projectID, roleID); err != nil {
		return nil, err
	}
	return s.repo.GrantUserRole(roleID, memberUserID, actorUserID, time.Now(), expiresAt)
}

// RevokeProjectRole 只有 Project owner 能呼叫；userRoleID 對應哪個 Project 由
// 呼叫端透過 roleID 再查一次 ProjectRoleByID 確認，避免 owner A 誤撤銷別的
// Project 底下的 grant。
func (s *Service) RevokeProjectRole(actorUserID, projectID, roleID, userRoleID uint64) error {
	project, err := s.repo.ProjectByID(projectID)
	if err != nil {
		return err
	}
	if project.UserID != actorUserID {
		return ErrRoleManagementOwnerOnly
	}
	if _, err := s.repo.ProjectRoleByID(projectID, roleID); err != nil {
		return err
	}
	return s.repo.RevokeUserRole(userRoleID, actorUserID)
}
