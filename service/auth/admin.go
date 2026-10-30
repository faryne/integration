package auth

import (
	"errors"

	authRepo "faryne.dev/repository/auth"
)

// ErrAdminRequired 不是管理者（users.is_admin）；galgame 管理與 AV 女優上稿審核共用
var ErrAdminRequired = errors.New("admin permission is required")

// RequireAdmin 確認登入者是管理者；主站與 galgame.tv 共用同一張 users 表與 is_admin 旗標
func RequireAdmin(userID uint64) error {
	if userID == 0 {
		return ErrAdminRequired
	}
	user, err := authRepo.NewUserRepository().UserByID(userID)
	if err != nil {
		return err
	}
	if !user.IsAdmin {
		return ErrAdminRequired
	}
	return nil
}
