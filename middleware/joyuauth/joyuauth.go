package joyuauth

import (
	"net/http"
	"strings"

	"faryne.dev/service/auth"
	"faryne.dev/service/output"

	"github.com/gofiber/fiber/v3"
)

// joyu.fyi 的登入：沒有 session、也沒有 users 表。前端每次呼叫 API 都帶
// Authorization: Bearer <joyu-firebase 簽發的 ID token>，這裡驗證後把 uid 放進 Locals 給 handler 用。
// token 一小時過期，前端的 Firebase SDK 會自動換新；這裡驗不過一律回 401，前端強制更新 token 再重試一次

const localsKey = "joyu_firebase_token"

// New 必須登入（匿名帳號也算）
func New() fiber.Handler {
	return func(c fiber.Ctx) error {
		raw, ok := strings.CutPrefix(c.Get(fiber.HeaderAuthorization), "Bearer ")
		if !ok || strings.TrimSpace(raw) == "" {
			return output.New(http.StatusUnauthorized, "", nil, "請先登入")
		}
		token, err := auth.VerifyFirebaseIDToken(strings.TrimSpace(raw), auth.BrandJoyu)
		if err != nil {
			return output.New(http.StatusUnauthorized, "", nil, "登入已失效，請重新登入")
		}
		c.Locals(localsKey, token)
		return c.Next()
	}
}

// Token 目前請求的登入者（New 之後才有值）
func Token(c fiber.Ctx) *auth.FirebaseToken {
	t, _ := c.Locals(localsKey).(*auth.FirebaseToken)
	return t
}
