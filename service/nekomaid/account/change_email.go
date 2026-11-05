package account

import (
	"context"
	"fmt"
	"net/http"
	"strings"
	"time"

	"faryne.dev/model/entity/nekomaid"
	nekomaidRepo "faryne.dev/repository/nekomaid"
	"faryne.dev/service/nekomaid/firebaseauth"
)

// ChangeEmail 改版前的舊帳號在整合（email 驗證）前修改 email（舊 email 可能早就收不到信）。
// 要輸入目前的密碼；Firebase 寄驗證信到新信箱，點了連結才真的換，同時算驗證完成、觸發整合，之後就不能再改。
// 每次申請重新給 24 小時，避免改完 email 卻因為舊信箱的期限被清除。
func ChangeEmail(ctx context.Context, userID uint64, req nekomaid.ChangeEmailRequest) error {
	users := nekomaidRepo.NewUserRepository()
	user, err := users.ByID(userID)
	if err != nil {
		return err
	}
	if !user.CanChangeEmail() {
		return newError(http.StatusForbidden, ReasonInvalidInput, "只有改版前的舊帳號、而且還沒完成 email 驗證時才能修改 email")
	}
	email := strings.TrimSpace(req.Email)
	if !validEmail(email) {
		return errInvalidInput("email 格式不正確")
	}
	if strings.EqualFold(email, strings.TrimSpace(user.Email)) {
		return errInvalidInput("跟目前的 email 一樣")
	}
	if !allow(fmt.Sprintf("nekomaid:email-change:user:%d", userID), 5, 24*time.Hour) {
		return errTooManyAttempts
	}

	fb := firebaseauth.New()
	// 重新驗密碼拿 idToken（後端不保存使用者的 Firebase token）
	account, err := fb.SignIn(ctx, user.Email, req.Password)
	if err != nil {
		if firebaseauth.IsInvalidCredentials(err) {
			return newError(http.StatusUnauthorized, ReasonInvalidCredentials, "密碼錯誤")
		}
		return firebaseLoginError(err)
	}
	switch err := fb.SendVerifyAndChangeEmail(ctx, account.IDToken, email); {
	case firebaseauth.IsCode(err, firebaseauth.CodeEmailExists):
		return errInvalidInput("這個 email 已經被其他帳號使用")
	case firebaseauth.IsCode(err, firebaseauth.CodeInvalidEmail):
		return errInvalidInput("email 格式不正確")
	case err != nil:
		return firebaseLoginError(err)
	}
	return users.Updates(user.Id, map[string]any{"pending_email": email, "verification_sent_at": time.Now()})
}
