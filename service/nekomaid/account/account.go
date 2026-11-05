package account

import (
	"time"

	modelAuth "faryne.dev/model/entity/auth"
	"faryne.dev/model/entity/nekomaid"
	nekomaidRepo "faryne.dev/repository/nekomaid"
	authService "faryne.dev/service/auth"
	"faryne.dev/service/log"
	"go.uber.org/zap"
)

// Current 目前登入者的資訊（頁首名稱、未驗證提示條的期限）
func Current(userID uint64) (*nekomaid.AccountResponse, error) {
	user, err := nekomaidRepo.NewUserRepository().ByID(userID)
	if err != nil {
		return nil, err
	}
	resp := &nekomaid.AccountResponse{
		Id: user.Id, Name: user.DisplayName(), Email: user.Email, EmailVerified: user.EmailVerifiedAt != nil,
	}
	resp.CanChangeEmail, resp.PendingEmail = user.CanChangeEmail(), user.PendingEmail
	if user.EmailVerifiedAt == nil && user.VerificationSentAt != nil {
		deadline := user.VerificationSentAt.Add(verificationWindow)
		resp.VerificationDeadline = &deadline
	}
	return resp, nil
}

// RunUnverifiedCleanup 每天一次：驗證信寄出超過 24 小時仍未驗證的帳號 soft delete（規格 §2.5），分批處理。
// 從沒寄過驗證信的舊帳號（一直沒回來登入的）不會被選到；Firebase 帳號不刪，本人用正確密碼回來登入會恢復。
func RunUnverifiedCleanup() {
	const batchSize, maxBatches = 500, 20
	users := nekomaidRepo.NewUserRepository()
	cutoff := time.Now().Add(-verificationWindow)
	var total int64
	for range maxBatches {
		n, err := users.SoftDeleteUnverified(cutoff, batchSize)
		if err != nil {
			log.Logger().Error("Nekomaid unverified cleanup failed", zap.Error(err))
			break
		}
		total += n
		if n < batchSize {
			break
		}
	}
	log.Logger().Info("Nekomaid unverified cleanup done", zap.Int64("deleted", total))
}

// CreateDevSession 本機自動化測試用：跳過 Firebase，用固定測試身分簽發 neko session（只在 ENABLE_DEV_AUTH_BYPASS 時註冊路由）。
// 測試帳號預設已驗證，頁面不會出現未驗證提示條。
func CreateDevSession() (*modelAuth.SessionResponse, error) {
	return authService.CreateDevSessionFor(authService.BrandNekomaid, func(verified *authService.FirebaseToken) (*modelAuth.User, error) {
		users := nekomaidRepo.NewUserRepository()
		user, err := users.ByFirebaseUID(verified.UID)
		if err != nil {
			now := time.Now()
			user = &nekomaid.User{FirebaseUid: &verified.UID, Email: *verified.Email, CreatedOn: now, EmailVerifiedAt: &now}
			if err := users.Create(user); err != nil {
				return nil, err
			}
		}
		email, name := user.Email, user.DisplayName()
		return &modelAuth.User{Id: user.Id, FirebaseUID: verified.UID, Email: &email, DisplayName: &name}, nil
	})
}
