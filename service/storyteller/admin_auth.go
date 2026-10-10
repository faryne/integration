package storyteller

import (
	"errors"
	"slices"
	"strings"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

// 平台（管理後台）授權與帳號停權檢查。平台權限只看 scope_type=platform 的角色，
// 不因擁有作品而放行，也不讀主站 users.is_admin。

var (
	// ErrAdminForbidden：沒有需要的平台權限
	ErrAdminForbidden = errors.New("storyteller: admin permission required")
	// ErrAccountSuspended：帳號已被站方停權（登入、session、PAT／OAuth 一律擋下）
	ErrAccountSuspended = errors.New("帳號已停用")
)

const adminPermissionPrefix = "admin."

// PlatformAuthorization 是某個使用者此刻的平台權限（已套用推導規則）。
type PlatformAuthorization map[storytellerModel.PermissionKey]bool

// Has：全部都有才算。
func (a PlatformAuthorization) Has(keys ...storytellerModel.PermissionKey) bool {
	for _, key := range keys {
		if !a[key] {
			return false
		}
	}
	return true
}

// derivePlatformPermissions：去掉 admin. 前綴後依「同資源 create／update ⇒ read」推導。
// 不沿用 project scope 的「持有子資源權限 ⇒ project.read」規則，平台權限各資源各自獨立。
func derivePlatformPermissions(keys []storytellerModel.PermissionKey) PlatformAuthorization {
	out := make(PlatformAuthorization, len(keys))
	for _, key := range keys {
		rest, ok := strings.CutPrefix(string(key), adminPermissionPrefix)
		if !ok {
			continue
		}
		out[key] = true
		if resource, action, found := strings.Cut(rest, "."); found && (action == "create" || action == "update") {
			out[storytellerModel.PermissionKey(adminPermissionPrefix+resource+".read")] = true
		}
	}
	return out
}

func (s *Service) PlatformAuthorizationFor(userID uint64) (PlatformAuthorization, error) {
	if userID == 0 {
		return PlatformAuthorization{}, nil
	}
	keys, err := s.repo.EffectivePlatformPermissionKeys(userID)
	if err != nil {
		return nil, err
	}
	return derivePlatformPermissions(keys), nil
}

// requirePlatform 取得授權並確認至少擁有 keys；每支後台方法進來都要先過這關。
func (s *Service) requirePlatform(userID uint64, keys ...storytellerModel.PermissionKey) (PlatformAuthorization, error) {
	auth, err := s.PlatformAuthorizationFor(userID)
	if err != nil {
		return nil, err
	}
	if !auth.Has(keys...) {
		return nil, ErrAdminForbidden
	}
	return auth, nil
}

// AdminMe 給前端決定要不要顯示後台入口與導覽項目。
func (s *Service) AdminMe(userID uint64) (*storytellerModel.AdminMeOutput, error) {
	auth, err := s.PlatformAuthorizationFor(userID)
	if err != nil {
		return nil, err
	}
	out := &storytellerModel.AdminMeOutput{Permissions: make([]storytellerModel.PermissionKey, 0, len(auth))}
	for key := range auth {
		out.Permissions = append(out.Permissions, key)
	}
	slices.Sort(out.Permissions)
	return out, nil
}

// EnsureAccountActive 擋下已被站方停權的帳號（本人刪帳號不算停權）。
func (s *Service) EnsureAccountActive(userID uint64) error {
	banned, err := s.repo.UserBanned(userID)
	if err != nil {
		return err
	}
	if banned {
		return ErrAccountSuspended
	}
	return nil
}
