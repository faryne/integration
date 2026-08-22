package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"time"

	"faryne.dev/config"
	modelAuth "faryne.dev/model/entity/auth"
	"faryne.dev/model/enum"
	authRepo "faryne.dev/repository/auth"
	"faryne.dev/service/client"
)

const sessionTTL = 24 * time.Hour
const sessionRedisKeyPrefix = "auth:session:"

// devAuthFirebaseUID／devAuthEmail／devAuthDisplayName 是 CreateDevSession 用的固定測試身分，
// 只在本機 `ENABLE_DEV_AUTH_BYPASS=true` 時才會被建立/簽發 session。firebase_uid 刻意加
// `dev-local-` 前綴，跟真實使用者（Firebase 簽發的 UID）在資料庫裡一眼可以分辨、不會混淆。
const devAuthFirebaseUID = "dev-local-claude-test"

var devAuthEmail = ptr("dev-local-claude-test@localhost.invalid")
var devAuthDisplayName = ptr("本機開發測試帳號（Claude）")

func ptr(s string) *string { return &s }

func CreateSession(idToken string) (*modelAuth.SessionResponse, error) {
	verified, err := VerifyFirebaseIDToken(idToken)
	if err != nil {
		return nil, err
	}

	user, err := authRepo.NewUserRepository().UpsertFirebaseUser(modelAuth.User{
		FirebaseUID: verified.UID,
		Email:       verified.Email,
		DisplayName: verified.DisplayName,
		PhotoURL:    verified.PhotoURL,
	})
	if err != nil {
		return nil, err
	}

	return issueSession(user)
}

// CreateDevSession 完全跳過 Firebase JWT 驗證，直接用固定的測試身分簽發合法 session——
// 給本機開發自動化測試用（例如免走 Firebase 登入彈窗直接進工作台頁面）。呼叫端
// （route/auth.go）只會在 `config.EnvConfig().EnableDevAuthBypass` 為 true 時才註冊
// 這個端點的路由，這裡再檢查一次是防禦性寫法，避免有人不小心繞過路由層直接呼叫。
func CreateDevSession() (*modelAuth.SessionResponse, error) {
	if !config.EnvConfig().EnableDevAuthBypass {
		return nil, errors.New("dev auth bypass is disabled")
	}

	user, err := authRepo.NewUserRepository().UpsertFirebaseUser(modelAuth.User{
		FirebaseUID: devAuthFirebaseUID,
		Email:       devAuthEmail,
		DisplayName: devAuthDisplayName,
	})
	if err != nil {
		return nil, err
	}

	return issueSession(user)
}

func issueSession(user *modelAuth.User) (*modelAuth.SessionResponse, error) {
	encryptKey, encryptKeyHash, err := newEncryptKey()
	if err != nil {
		return nil, err
	}

	now := time.Now()
	expiresAt := now.Add(sessionTTL)
	session := modelAuth.RedisSession{
		UserId:      user.Id,
		FirebaseUID: user.FirebaseUID,
		CreatedAt:   now.Format(time.RFC3339),
		ExpiresAt:   expiresAt.Format(time.RFC3339),
	}
	if err := storeSession(encryptKeyHash, session); err != nil {
		return nil, err
	}

	return &modelAuth.SessionResponse{
		User: modelAuth.UserResponse{
			Id:          user.Id,
			FirebaseUID: user.FirebaseUID,
			Email:       user.Email,
			DisplayName: user.DisplayName,
			PhotoURL:    user.PhotoURL,
			IsAdmin:     user.IsAdmin,
		},
		EncryptKey: encryptKey,
		ExpiresAt:  expiresAt.Format(time.RFC3339),
	}, nil
}

func DestroySession(encryptKey string) error {
	encryptKeyHash := hashEncryptKey(encryptKey)
	r := client.GetRedis(enum.RedisDefault)
	if r == nil {
		return errors.New("Redis is not configured")
	}
	return r.Del(sessionRedisKey(encryptKeyHash)).Err()
}

func storeSession(encryptKeyHash string, session modelAuth.RedisSession) error {
	r := client.GetRedis(enum.RedisDefault)
	if r == nil {
		return errors.New("Redis is not configured")
	}

	data, err := json.Marshal(session)
	if err != nil {
		return err
	}
	return r.Set(sessionRedisKey(encryptKeyHash), string(data), sessionTTL).Err()
}

func newEncryptKey() (string, string, error) {
	raw := make([]byte, 32)
	if _, err := rand.Read(raw); err != nil {
		return "", "", err
	}

	key := base64.RawURLEncoding.EncodeToString(raw)
	return key, hashEncryptKey(key), nil
}

func hashEncryptKey(encryptKey string) string {
	sum := sha256.Sum256([]byte(encryptKey))
	return hex.EncodeToString(sum[:])
}

func sessionRedisKey(encryptKeyHash string) string {
	return sessionRedisKeyPrefix + encryptKeyHash
}
