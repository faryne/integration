package account

import (
	"context"
	"errors"
	"net/mail"
	"strings"
	"time"

	modelAuth "faryne.dev/model/entity/auth"
	"faryne.dev/model/entity/nekomaid"
	nekomaidRepo "faryne.dev/repository/nekomaid"
	authService "faryne.dev/service/auth"
	"faryne.dev/service/log"
	"faryne.dev/service/nekomaid/firebaseauth"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

const (
	// Firebase 的密碼下限
	minPasswordLength = 6
	// 驗證信寄出後幾小時內沒驗證就清除（也是自動重寄的間隔）
	verificationWindow = 24 * time.Hour
)

// Login 單一登入表單：login 是帳號或 email（規格 §2.2）。
// 帳號對得到 users_v2.username 就當帳號；否則當 email 先問 Firebase，失敗再找還沒搬家的舊帳號。
func Login(ctx context.Context, req nekomaid.LoginRequest, ip string) (*modelAuth.SessionResponse, error) {
	login := strings.TrimSpace(req.Login)
	if login == "" || req.Password == "" {
		return nil, errInvalidCredentials
	}
	if !allowLogin(ip, login) {
		return nil, errTooManyAttempts
	}
	users := nekomaidRepo.NewUserRepository()

	user, err := users.ByUsername(login)
	switch {
	case err == nil:
		return loginByUsername(ctx, user, req)
	case !errors.Is(err, gorm.ErrRecordNotFound):
		return nil, err
	}
	return loginByEmail(ctx, login, req)
}

func loginByUsername(ctx context.Context, user *nekomaid.User, req nekomaid.LoginRequest) (*modelAuth.SessionResponse, error) {
	switch {
	case user.MergedIntoId != nil:
		return nil, mergedError(user, req.Password)
	case user.FirebaseUid != nil:
		// 已搬過：用帳號的 email 由 Firebase 驗密碼
		account, err := firebaseauth.New().SignIn(ctx, user.Email, req.Password)
		if err != nil {
			return nil, firebaseLoginError(err)
		}
		return finishLogin(ctx, user, account.IDToken)
	case user.IsDeleted:
		return nil, errInvalidCredentials
	}
	return migrate(ctx, user, req)
}

func loginByEmail(ctx context.Context, email string, req nekomaid.LoginRequest) (*modelAuth.SessionResponse, error) {
	users := nekomaidRepo.NewUserRepository()
	account, err := firebaseauth.New().SignIn(ctx, email, req.Password)
	if err == nil {
		user, err := users.ByFirebaseUID(account.LocalID)
		if errors.Is(err, gorm.ErrRecordNotFound) {
			// Firebase 有帳號但我們沒有（建帳號途中失敗）：補建一筆
			user = &nekomaid.User{FirebaseUid: &account.LocalID, Email: account.Email, CreatedOn: time.Now()}
			err = users.Create(user)
		}
		if err != nil {
			return nil, err
		}
		return finishLogin(ctx, user, account.IDToken)
	}
	if !firebaseauth.IsInvalidCredentials(err) {
		return nil, firebaseLoginError(err)
	}

	// Firebase 沒這個帳號或密碼不對：找同 email、還沒搬家的舊帳號，密碼對得上的就是目前帳號（多個都對得上取最早註冊的）
	candidates, err := users.UnmigratedByEmail(email)
	if err != nil {
		return nil, err
	}
	for i := range candidates {
		if _, ok := legacyPasswordScheme(candidates[i].Userpass, req.Password); ok {
			return migrate(ctx, &candidates[i], req)
		}
	}
	// 都對不上：看是不是已被合併的帳號
	merged, err := users.MergedByEmail(email)
	if err != nil {
		return nil, err
	}
	for i := range merged {
		if mergedErr := mergedError(&merged[i], req.Password); !errors.Is(mergedErr, errInvalidCredentials) {
			return nil, mergedErr
		}
	}
	return nil, errInvalidCredentials
}

// migrate 舊會員第一次登入：驗舊雜湊 → 用 email＋這次的密碼註冊 Firebase → 綁定、清掉舊雜湊 → 寄驗證信。
// 同 email 的其他舊帳號要等 email 驗證成功才合併（§2.5）。
func migrate(ctx context.Context, user *nekomaid.User, req nekomaid.LoginRequest) (*modelAuth.SessionResponse, error) {
	scheme, ok := legacyPasswordScheme(user.Userpass, req.Password)
	if !ok {
		return nil, errInvalidCredentials
	}
	log.Logger().Info("Nekomaid legacy password matched", zap.Uint64("user_id", user.Id), zap.String("scheme", scheme))

	email := strings.TrimSpace(user.Email)
	if newEmail := strings.TrimSpace(req.NewEmail); newEmail != "" {
		email = newEmail
	}
	if !validEmail(email) {
		return nil, errNeedEmail("這個帳號的 email 無法使用，請填寫新的 email")
	}
	password := req.Password
	if req.NewPassword != "" {
		password = req.NewPassword
	}
	if len([]rune(password)) < minPasswordLength {
		return nil, errNeedPassword()
	}

	fb := firebaseauth.New()
	account, err := fb.SignUp(ctx, email, password)
	switch {
	case firebaseauth.IsCode(err, firebaseauth.CodeWeakPassword):
		return nil, errNeedPassword()
	case firebaseauth.IsCode(err, firebaseauth.CodeInvalidEmail):
		return nil, errNeedEmail("這個帳號的 email 無法使用，請填寫新的 email")
	case firebaseauth.IsCode(err, firebaseauth.CodeEmailExists):
		// email 已在 Firebase：同一組密碼登得進去＝同一個人（例如同 email 的另一個舊帳號已搬過、密碼也一樣）
		if req.NewEmail == "" {
			if existing, signInErr := fb.SignIn(ctx, email, password); signInErr == nil {
				return loginExisting(ctx, user, existing)
			}
		}
		return nil, errNeedEmail("這個 email 已經被其他帳號使用，請填寫新的 email")
	case err != nil:
		return nil, firebaseLoginError(err)
	}
	return bindAndFinish(ctx, user, account, email)
}

// loginExisting 搬家時 email 已有 Firebase 帳號且密碼相符：已綁別的帳號就登入那個帳號（這個舊帳號等驗證後合併），沒綁就綁到這個舊帳號
func loginExisting(ctx context.Context, user *nekomaid.User, account *firebaseauth.Account) (*modelAuth.SessionResponse, error) {
	bound, err := nekomaidRepo.NewUserRepository().ByFirebaseUID(account.LocalID)
	switch {
	case err == nil:
		return finishLogin(ctx, bound, account.IDToken)
	case !errors.Is(err, gorm.ErrRecordNotFound):
		return nil, err
	}
	return bindAndFinish(ctx, user, account, account.Email)
}

// bindAndFinish 綁定 Firebase UID、清掉舊雜湊（舊密碼從此由 Firebase 管）
func bindAndFinish(ctx context.Context, user *nekomaid.User, account *firebaseauth.Account, email string) (*modelAuth.SessionResponse, error) {
	if err := nekomaidRepo.NewUserRepository().Updates(user.Id, map[string]any{
		"firebase_uid": account.LocalID, "email": email, "userpass": "",
	}); err != nil {
		return nil, err
	}
	user.FirebaseUid, user.Email, user.Userpass = &account.LocalID, email, ""
	return finishLogin(ctx, user, account.IDToken)
}

// finishLogin 登入成功的共同收尾：被清除的未驗證帳號恢復；還沒驗證就（24 小時最多一次）重寄驗證信並重新計時；發 session
func finishLogin(ctx context.Context, user *nekomaid.User, idToken string) (*modelAuth.SessionResponse, error) {
	users := nekomaidRepo.NewUserRepository()
	if user.IsDeleted && user.MergedIntoId == nil {
		if err := users.Updates(user.Id, map[string]any{"is_deleted": 0, "deleted_at": nil}); err != nil {
			return nil, err
		}
		user.IsDeleted, user.DeletedAt = false, nil
	}
	if user.EmailVerifiedAt == nil && (user.VerificationSentAt == nil || time.Since(*user.VerificationSentAt) >= verificationWindow) {
		sendVerification(ctx, user, idToken)
	}
	return issueSession(user)
}

// sendVerification 寄驗證信並記下時間；寄信失敗只記 log，不擋登入（下次登入會再寄）
func sendVerification(ctx context.Context, user *nekomaid.User, idToken string) {
	if err := firebaseauth.New().SendVerifyEmail(ctx, idToken); err != nil {
		log.Logger().Warn("Send nekomaid verification email failed", zap.Uint64("user_id", user.Id), zap.Error(err))
		return
	}
	now := time.Now()
	if err := nekomaidRepo.NewUserRepository().Updates(user.Id, map[string]any{"verification_sent_at": now}); err != nil {
		log.Logger().Warn("Record nekomaid verification time failed", zap.Uint64("user_id", user.Id), zap.Error(err))
		return
	}
	user.VerificationSentAt = &now
}

// mergedError 用已合併的帳號登入：舊密碼對得上才告訴他合併到哪個帳號，否則一律「帳號或密碼錯誤」
func mergedError(user *nekomaid.User, password string) error {
	if _, ok := legacyPasswordScheme(user.Userpass, password); !ok || user.MergedIntoId == nil {
		return errInvalidCredentials
	}
	target, err := nekomaidRepo.NewUserRepository().ByID(*user.MergedIntoId)
	if err != nil {
		return err
	}
	return errMerged(target.DisplayName())
}

// firebaseLoginError Firebase 的錯誤轉成給使用者看的錯誤
func firebaseLoginError(err error) error {
	switch {
	case firebaseauth.IsInvalidCredentials(err), firebaseauth.IsCode(err, firebaseauth.CodeUserDisabled):
		return errInvalidCredentials
	case firebaseauth.IsCode(err, firebaseauth.CodeTooManyAttempts):
		return errTooManyAttempts
	}
	return err
}

// issueSession 用 neko brand 簽發 session
func issueSession(user *nekomaid.User) (*modelAuth.SessionResponse, error) {
	uid, email, name := "", user.Email, user.DisplayName()
	if user.FirebaseUid != nil {
		uid = *user.FirebaseUid
	}
	return authService.IssueSessionFor(&modelAuth.User{Id: user.Id, FirebaseUID: uid, Email: &email, DisplayName: &name}, authService.BrandNekomaid)
}

// validEmail 只接受單純的 email（不含顯示名稱）
func validEmail(email string) bool {
	addr, err := mail.ParseAddress(email)
	return err == nil && addr.Address == email && len(email) <= 100
}
