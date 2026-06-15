package authsession

import (
	"errors"
	"strings"

	modelAuth "faryne.dev/model/entity/auth"
	authService "faryne.dev/service/auth"
	"faryne.dev/service/output"
	"github.com/gofiber/fiber/v3"
)

const (
	LocalAuthSession = "auth_session"
	HeaderEncryptKey = "X-Encrypt-Key"
)

func New() fiber.Handler {
	return func(ctx fiber.Ctx) error {
		encryptKey := strings.TrimSpace(ctx.Get(HeaderEncryptKey))
		if encryptKey == "" {
			return output.Unauthorized(errors.New("X-Encrypt-Key header is required"))
		}
		session, err := authService.GetSessionByEncryptKey(encryptKey)
		if err != nil {
			return output.Unauthorized(err)
		}
		ctx.Locals(LocalAuthSession, session)
		return ctx.Next()
	}
}

func Session(ctx fiber.Ctx) *modelAuth.RedisSession {
	session, _ := ctx.Locals(LocalAuthSession).(*modelAuth.RedisSession)
	return session
}
