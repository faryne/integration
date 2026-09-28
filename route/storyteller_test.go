package route

import (
	"io"
	"net/http"
	"net/http/httptest"
	"testing"

	storytellerAudit "faryne.dev/middleware/storytelleraudit"
	"faryne.dev/service/output"
	"github.com/gofiber/fiber/v3"
	"github.com/stretchr/testify/require"
)

func TestStorytellerLogoutSucceedsWithExpiredSession(t *testing.T) {
	app := fiber.New(fiber.Config{ErrorHandler: func(ctx fiber.Ctx, err error) error {
		if response, ok := err.(output.CommonOutputInterface); ok {
			return ctx.Status(response.HttpCode()).JSON(response.Output(0, ctx.Path()))
		}
		return err
	}})
	app.Use(storytellerAudit.NewRequestContext())
	Storyteller(app)

	request := httptest.NewRequest(http.MethodDelete, "/storyteller/auth/session", nil)
	request.Header.Set("X-Encrypt-Key", "expired-session-key")
	response, err := app.Test(request)
	require.NoError(t, err)
	require.Equal(t, http.StatusOK, response.StatusCode)
	body, err := io.ReadAll(response.Body)
	require.NoError(t, err)
	require.NotContains(t, string(body), "redis")
}
