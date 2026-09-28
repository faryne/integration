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

const (
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

func Session(ctx fiber.Ctx) *modelAuth.RedisSession {
	session, _ := ctx.Locals(LocalAuthSession).(*modelAuth.RedisSession)
	return session
}
