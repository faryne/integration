// Package firebaseauth 是 neko 帳號用的 Firebase Identity Toolkit REST 客戶端。
// 註冊、登入、寄信全部由後端呼叫（只需要 Web API Key，不需要管理者金鑰），前端不載入 Firebase 登入 SDK，
// 所以 Firebase 帳號只會經由我們的後端建立（見規格 §2）。
package firebaseauth

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strings"
	"time"

	"faryne.dev/config"
)

// Firebase 回的錯誤碼（error.message 冒號前的部分）
const (
	CodeEmailExists        = "EMAIL_EXISTS"
	CodeWeakPassword       = "WEAK_PASSWORD"
	CodeInvalidEmail       = "INVALID_EMAIL"
	CodeInvalidCredentials = "INVALID_LOGIN_CREDENTIALS"
	CodeInvalidPassword    = "INVALID_PASSWORD"
	CodeEmailNotFound      = "EMAIL_NOT_FOUND"
	CodeTooManyAttempts    = "TOO_MANY_ATTEMPTS_TRY_LATER"
	CodeUserDisabled       = "USER_DISABLED"
	CodeExpiredOobCode     = "EXPIRED_OOB_CODE"
	CodeInvalidOobCode     = "INVALID_OOB_CODE"
)

// ErrNotConfigured 沒設 NEKOMAID_FIREBASE_API_KEY
var ErrNotConfigured = errors.New("NEKOMAID_FIREBASE_API_KEY is not configured")

// Error Firebase 回的業務錯誤；Code 是 error.message 冒號前的錯誤碼（例如 WEAK_PASSWORD）
type Error struct {
	Code    string
	Message string
}

func (e *Error) Error() string { return "firebase auth: " + e.Message }

// IsCode 判斷 err 是不是指定錯誤碼的 Firebase 錯誤
func IsCode(err error, codes ...string) bool {
	var fe *Error
	if !errors.As(err, &fe) {
		return false
	}
	for _, code := range codes {
		if fe.Code == code {
			return true
		}
	}
	return false
}

// IsInvalidCredentials 帳號不存在或密碼錯（開啟 email 列舉保護時一律回 INVALID_LOGIN_CREDENTIALS）
func IsInvalidCredentials(err error) bool {
	return IsCode(err, CodeInvalidCredentials, CodeInvalidPassword, CodeEmailNotFound)
}

// Account 註冊或登入成功後拿到的帳號資訊；IDToken 用來寄驗證信
type Account struct {
	LocalID string `json:"localId"`
	Email   string `json:"email"`
	IDToken string `json:"idToken"`
}

// Client Identity Toolkit REST 客戶端
type Client struct {
	endpoint string
	apiKey   string
	http     *http.Client
}

// New 依設定建立客戶端；本機可把 endpoint 指到 Firebase Auth 模擬器
func New() *Client {
	cfg := config.EnvConfig()
	return NewWith(cfg.NekomaidFirebaseAuthEndpoint, cfg.NekomaidFirebaseAPIKey)
}

// NewWith 指定 endpoint 與 API key（測試用）
func NewWith(endpoint, apiKey string) *Client {
	return &Client{
		endpoint: strings.TrimRight(endpoint, "/"),
		apiKey:   apiKey,
		http:     &http.Client{Timeout: 10 * time.Second},
	}
}

// SignUp 建立 email／密碼帳號
func (c *Client) SignUp(ctx context.Context, email, password string) (*Account, error) {
	var out Account
	err := c.call(ctx, "accounts:signUp", map[string]any{"email": email, "password": password, "returnSecureToken": true}, &out)
	return &out, err
}

// SignIn 用 email／密碼登入
func (c *Client) SignIn(ctx context.Context, email, password string) (*Account, error) {
	var out Account
	err := c.call(ctx, "accounts:signInWithPassword", map[string]any{"email": email, "password": password, "returnSecureToken": true}, &out)
	return &out, err
}

// SendVerifyEmail 寄 email 驗證信（需要該帳號的 idToken）
func (c *Client) SendVerifyEmail(ctx context.Context, idToken string) error {
	return c.call(ctx, "accounts:sendOobCode", map[string]any{"requestType": "VERIFY_EMAIL", "idToken": idToken}, nil)
}

// SendPasswordReset 寄重設密碼信
func (c *Client) SendPasswordReset(ctx context.Context, email string) error {
	return c.call(ctx, "accounts:sendOobCode", map[string]any{"requestType": "PASSWORD_RESET", "email": email}, nil)
}

// ConfirmEmailVerification 用信件連結裡的 oobCode 完成 email 驗證，回傳被驗證的 email
func (c *Client) ConfirmEmailVerification(ctx context.Context, oobCode string) (string, error) {
	var out struct {
		Email string `json:"email"`
	}
	err := c.call(ctx, "accounts:update", map[string]any{"oobCode": oobCode}, &out)
	return out.Email, err
}

// ResetPassword 用重設密碼信的 oobCode 設定新密碼，回傳帳號 email
func (c *Client) ResetPassword(ctx context.Context, oobCode, newPassword string) (string, error) {
	var out struct {
		Email string `json:"email"`
	}
	err := c.call(ctx, "accounts:resetPassword", map[string]any{"oobCode": oobCode, "newPassword": newPassword}, &out)
	return out.Email, err
}

// call 打 Identity Toolkit；非 2xx 時把 error.message 解析成 *Error
func (c *Client) call(ctx context.Context, method string, body, out any) error {
	if c.apiKey == "" {
		return ErrNotConfigured
	}
	raw, err := json.Marshal(body)
	if err != nil {
		return err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, fmt.Sprintf("%s/v1/%s?key=%s", c.endpoint, method, c.apiKey), bytes.NewReader(raw))
	if err != nil {
		return err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := c.http.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= http.StatusBadRequest {
		var failure struct {
			Error struct {
				Message string `json:"message"`
			} `json:"error"`
		}
		_ = json.NewDecoder(resp.Body).Decode(&failure)
		message := failure.Error.Message
		if message == "" {
			message = resp.Status
		}
		// 例如 "WEAK_PASSWORD : Password should be at least 6 characters"
		code, _, _ := strings.Cut(message, " ")
		return &Error{Code: code, Message: message}
	}
	if out == nil {
		return nil
	}
	return json.NewDecoder(resp.Body).Decode(out)
}
