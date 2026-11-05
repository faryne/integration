package account

import (
	"context"
	"net/http"
	"strings"
	"time"

	modelAuth "faryne.dev/model/entity/auth"
	"faryne.dev/model/entity/nekomaid"
	nekomaidRepo "faryne.dev/repository/nekomaid"
	"faryne.dev/service/nekomaid/firebaseauth"
)

// Register 新會員註冊：email 是還沒搬家的舊會員就不建新帳號（請他用舊密碼登入或重設密碼）；
// 否則註冊 Firebase、建 users_v2、寄驗證信、發 session。Firebase 帳號只會經由後端建立，所以不會有人搶註別人的舊 email。
func Register(ctx context.Context, req nekomaid.RegisterRequest, ip string) (*modelAuth.SessionResponse, error) {
	email := strings.TrimSpace(req.Email)
	if !validEmail(email) {
		return nil, errInvalidInput("email 格式不正確")
	}
	if len([]rune(req.Password)) < minPasswordLength {
		return nil, errInvalidInput("密碼至少要 6 個字")
	}
	if !allowRegister(ip) {
		return nil, errTooManyAttempts
	}
	users := nekomaidRepo.NewUserRepository()
	if legacy, err := users.UnmigratedByEmail(email); err != nil {
		return nil, err
	} else if len(legacy) > 0 {
		return nil, newError(http.StatusConflict, ReasonLegacyEmail, "這個 email 已經有帳號，請用原本的密碼登入，或重設密碼")
	}

	account, err := firebaseauth.New().SignUp(ctx, email, req.Password)
	switch {
	case firebaseauth.IsCode(err, firebaseauth.CodeEmailExists):
		return nil, newError(http.StatusConflict, ReasonEmailRegistered, "這個 email 已經註冊，請直接登入或重設密碼")
	case firebaseauth.IsCode(err, firebaseauth.CodeWeakPassword):
		return nil, errInvalidInput("密碼強度不足，請換一個")
	case firebaseauth.IsCode(err, firebaseauth.CodeInvalidEmail):
		return nil, errInvalidInput("email 格式不正確")
	case err != nil:
		return nil, firebaseLoginError(err)
	}

	user := &nekomaid.User{FirebaseUid: &account.LocalID, Email: email, CreatedOn: time.Now()}
	if err := users.Create(user); err != nil {
		return nil, err
	}
	return finishLogin(ctx, user, account.IDToken)
}
