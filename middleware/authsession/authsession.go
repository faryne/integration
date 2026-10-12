package authsession

import (
	"errors"
	"strings"

	storytellerAudit "faryne.dev/middleware/storytelleraudit"
	modelAuth "faryne.dev/model/entity/auth"
	storytellerModel "faryne.dev/model/entity/storyteller"
	authService "faryne.dev/service/auth"
	"faryne.dev/service/output"
	auditService "faryne.dev/service/storytelleraudit"
	"github.com/gofiber/fiber/v3"
)

// customCodeSessionRequired：Bearer token 打到只限網站 session 的端點（見 SessionOnly）
const customCodeSessionRequired output.CustomCode = "403301"

const (
	// localViaBearer 標記這個請求的 session 是由 Bearer token 轉來的，給 SessionOnly 判斷
	localViaBearer = "auth_session_via_bearer"

	LocalAuthSession       = "auth_session"
	HeaderEncryptKey       = "X-Encrypt-Key"
	HeaderSessionExpiresAt = "X-Session-Expires-At"
)

func New(expectedBrand string) fiber.Handler {
	return func(ctx fiber.Ctx) error {
		encryptKey := strings.TrimSpace(ctx.Get(HeaderEncryptKey))
		if encryptKey == "" {
			return output.Unauthorized(errors.New("X-Encrypt-Key header is required"))
		}
		session, err := authService.GetSessionByEncryptKey(encryptKey)
		if err != nil {
			return output.Unauthorized(err)
		}
		if session.Brand != expectedBrand {
			return output.Unauthorized(errors.New("session brand mismatch"))
		}
		ctx.Locals(LocalAuthSession, session)
		storytellerAudit.Set(ctx, func(audit *auditService.RequestContext) {
			audit.ActorUserID = session.UserId
			audit.AuthMethod = storytellerModel.AuditAuthMethodSession
		})
		ctx.Set(HeaderSessionExpiresAt, session.ExpiresAt)
		return ctx.Next()
	}
}

// Optional 只在 session 存在且品牌相符時補上身分，過期或無效 session 仍繼續。
// 用於 logout 這類必須冪等、不能被驗證失敗擋住的端點。
func Optional(expectedBrand string) fiber.Handler {
	return optional(expectedBrand, authService.GetSessionByEncryptKey)
}

type sessionLookup func(string) (*modelAuth.RedisSession, error)

func optional(expectedBrand string, lookup sessionLookup) fiber.Handler {
	return func(ctx fiber.Ctx) error {
		encryptKey := strings.TrimSpace(ctx.Get(HeaderEncryptKey))
		if encryptKey == "" {
			return ctx.Next()
		}
		session, err := lookup(encryptKey)
		if err != nil || session == nil || session.Brand != expectedBrand {
			return ctx.Next()
		}
		ctx.Locals(LocalAuthSession, session)
		storytellerAudit.Set(ctx, func(audit *auditService.RequestContext) {
			audit.ActorUserID = session.UserId
			audit.AuthMethod = storytellerModel.AuditAuthMethodSession
		})
		return ctx.Next()
	}
}

// NewWithBearer 跟 New 一樣驗證網站 session，但前面的 middleware（storytellerbearer.Optional）若已經用
// Bearer token（OAuth／PAT）驗過身分，就把它轉成 session 形狀直接放行：同一組 handler 讀 Session(ctx).UserId
// 就能同時服務網站與原生 app（SteamLoom Writer），不用另開一組路由。bearerUserID 由呼叫端傳入，避免 import 循環。
func NewWithBearer(expectedBrand string, bearerUserID func(fiber.Ctx) uint64) fiber.Handler {
	session := New(expectedBrand)
	return func(ctx fiber.Ctx) error {
		if userID := bearerUserID(ctx); userID != 0 {
			ctx.Locals(LocalAuthSession, &modelAuth.RedisSession{UserId: userID, Brand: expectedBrand})
			ctx.Locals(localViaBearer, true)
			return ctx.Next()
		}
		return session(ctx)
	}
}

// SessionOnly 掛在帳號安全相關的端點（刪除帳號、PAT、OAuth 授權、Provider 金鑰、稽核、管理後台）：
// 只接受網站登入的 session，拒絕 Bearer token。OAuth 授權頁承諾第三方工具「不能變更帳號設定、刪除帳號、
// 查看或使用 Provider 金鑰／PAT 與其他授權」，也避免拿到 OAuth token 的工具自己生出一把 PAT。
func SessionOnly() fiber.Handler {
	return func(ctx fiber.Ctx) error {
		if viaBearer, _ := ctx.Locals(localViaBearer).(bool); viaBearer {
			return output.New(fiber.StatusForbidden, customCodeSessionRequired, nil, "這個操作只能在網站上進行")
		}
		return ctx.Next()
	}
}

func Session(ctx fiber.Ctx) *modelAuth.RedisSession {
	session, _ := ctx.Locals(LocalAuthSession).(*modelAuth.RedisSession)
	return session
}
