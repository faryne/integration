package account

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"strings"
	"time"

	"faryne.dev/model/entity/nekomaid"
	nekomaidRepo "faryne.dev/repository/nekomaid"
	"faryne.dev/service/log"
	"faryne.dev/service/nekomaid/firebaseauth"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// 信件連結的 mode（Firebase 動作網址帶來的參數）
const (
	ModeVerifyEmail   = "verifyEmail"
	ModeResetPassword = "resetPassword"
)

// PasswordReset 忘記密碼：還沒搬家的舊會員先代建 Firebase 帳號並綁定（重設完就能登入），再請 Firebase 寄重設信。
// 不論 email 存不存在都回成功，不能拿來查帳號。
func PasswordReset(ctx context.Context, req nekomaid.PasswordResetRequest, ip string) error {
	email := strings.TrimSpace(req.Email)
	if !validEmail(email) {
		return errInvalidInput("email 格式不正確")
	}
	if !allowPasswordReset(ip, email) {
		return errTooManyAttempts
	}
	fb := firebaseauth.New()
	users := nekomaidRepo.NewUserRepository()
	legacy, err := users.UnmigratedByEmail(email)
	if err != nil {
		return err
	}
	if len(legacy) > 0 {
		// 取最早註冊的舊帳號；其他同 email 的在重設完成（等同驗證信箱）時合併
		account, err := fb.SignUp(ctx, email, randomPassword())
		switch {
		case err == nil:
			// 忘記密碼就不再接受舊密碼：清掉舊雜湊，之後一律走 Firebase
			if err := users.Updates(legacy[0].Id, map[string]any{"firebase_uid": account.LocalID, "userpass": ""}); err != nil {
				return err
			}
		case !firebaseauth.IsCode(err, firebaseauth.CodeEmailExists):
			log.Logger().Warn("Create nekomaid firebase account for password reset failed", zap.Uint64("user_id", legacy[0].Id), zap.Error(err))
			return nil
		}
	}
	if err := fb.SendPasswordReset(ctx, email); err != nil && !firebaseauth.IsInvalidCredentials(err) {
		if firebaseauth.IsCode(err, firebaseauth.CodeTooManyAttempts) {
			return errTooManyAttempts
		}
		log.Logger().Warn("Send nekomaid password reset failed", zap.Error(err))
	}
	return nil
}

// HandleAction 信件連結回到 neko.maid.tw/auth/action：驗證 email 或重設密碼。
// 兩者都證明了信箱主人身分，所以都會記下驗證時間並合併同 email 的舊帳號。
func HandleAction(ctx context.Context, req nekomaid.AuthActionRequest) (*nekomaid.AuthActionResult, error) {
	fb := firebaseauth.New()
	var email string
	var err error
	switch req.Mode {
	case ModeVerifyEmail:
		email, err = fb.ConfirmEmailVerification(ctx, req.OobCode)
	case ModeResetPassword:
		if len([]rune(req.NewPassword)) < minPasswordLength {
			return nil, errInvalidInput("密碼至少要 6 個字")
		}
		email, err = fb.ResetPassword(ctx, req.OobCode, req.NewPassword)
		if firebaseauth.IsCode(err, firebaseauth.CodeWeakPassword) {
			return nil, errInvalidInput("密碼強度不足，請換一個")
		}
	default:
		return nil, errLinkInvalid
	}
	switch {
	case firebaseauth.IsCode(err, firebaseauth.CodeExpiredOobCode, firebaseauth.CodeInvalidOobCode):
		return nil, errLinkInvalid
	case err != nil:
		return nil, err
	}

	user, err := nekomaidRepo.NewUserRepository().BoundByEmail(email)
	if errors.Is(err, gorm.ErrRecordNotFound) {
		return &nekomaid.AuthActionResult{Email: email, Merged: []string{}}, nil
	} else if err != nil {
		return nil, err
	}
	merged, err := markVerified(user)
	return &nekomaid.AuthActionResult{Email: email, Merged: merged}, err
}

// markVerified 記下 email 驗證時間（被清除的帳號一併恢復），並把同 email、還沒搬家的舊帳號合併進來；回傳被併的帳號名稱
func markVerified(user *nekomaid.User) ([]string, error) {
	users := nekomaidRepo.NewUserRepository()
	fields := map[string]any{"is_deleted": 0, "deleted_at": nil}
	if user.EmailVerifiedAt == nil {
		fields["email_verified_at"] = time.Now()
	}
	if err := users.Updates(user.Id, fields); err != nil {
		return nil, err
	}
	others, err := users.UnmigratedByEmail(user.Email)
	if err != nil {
		return nil, err
	}
	ids, names := make([]uint64, 0, len(others)), make([]string, 0, len(others))
	for _, other := range others {
		if other.Id != user.Id {
			ids, names = append(ids, other.Id), append(names, other.DisplayName())
		}
	}
	if err := users.MergeInto(user.Id, ids); err != nil {
		return nil, err
	}
	if len(ids) > 0 {
		log.Logger().Info("Nekomaid accounts merged after email verification", zap.Uint64("user_id", user.Id), zap.Uint64s("merged", ids))
	}
	return names, nil
}

// randomPassword 忘記密碼時代建 Firebase 帳號用的臨時密碼（使用者不會知道，重設後就換掉）
func randomPassword() string {
	b := make([]byte, 24)
	_, _ = rand.Read(b)
	return hex.EncodeToString(b)
}
