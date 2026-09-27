package authsession

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	storytellerAudit "faryne.dev/middleware/storytelleraudit"
	modelAuth "faryne.dev/model/entity/auth"
	storytellerModel "faryne.dev/model/entity/storyteller"
	auditService "faryne.dev/service/storytelleraudit"
	"github.com/gofiber/fiber/v3"
	"github.com/stretchr/testify/require"
)

func TestOptionalSessionAddsMatchingActor(t *testing.T) {
	app := fiber.New()
	app.Use(storytellerAudit.NewRequestContext())
	app.Use(optional("storyteller", func(string) (*modelAuth.RedisSession, error) {
		return &modelAuth.RedisSession{UserId: 42, Brand: "storyteller"}, nil
	}))
	var captured auditService.RequestContext
	app.Get("/", func(ctx fiber.Ctx) error {
		captured, _ = auditService.RequestContextFrom(ctx.Context())
		return ctx.SendStatus(http.StatusNoContent)
	})

	request := httptest.NewRequest(http.MethodGet, "/", nil)
	request.Header.Set(HeaderEncryptKey, "session-key")
	response, err := app.Test(request)
	require.NoError(t, err)
	require.Equal(t, http.StatusNoContent, response.StatusCode)
	require.Equal(t, uint64(42), captured.ActorUserID)
	require.Equal(t, storytellerModel.AuditAuthMethodSession, captured.AuthMethod)
}

func TestOptionalSessionIgnoresLookupFailure(t *testing.T) {
	app := fiber.New()
	app.Use(storytellerAudit.NewRequestContext())
	app.Use(optional("storyteller", func(string) (*modelAuth.RedisSession, error) {
		return nil, errors.New("expired")
	}))
	called := false
	app.Get("/", func(ctx fiber.Ctx) error {
		called = true
		return ctx.SendStatus(http.StatusNoContent)
	})

	request := httptest.NewRequest(http.MethodGet, "/", nil)
	request.Header.Set(HeaderEncryptKey, "expired-session-key")
	response, err := app.Test(request)
	require.NoError(t, err)
	require.Equal(t, http.StatusNoContent, response.StatusCode)
	require.True(t, called)
}
