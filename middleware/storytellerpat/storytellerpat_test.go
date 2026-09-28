package storytellerpat

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	storytellerAudit "faryne.dev/middleware/storytelleraudit"
	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/service/output"
	storytellerService "faryne.dev/service/storyteller"
	auditService "faryne.dev/service/storytelleraudit"
	"github.com/gofiber/fiber/v3"
	"github.com/stretchr/testify/require"
)

func TestDeniedPATAttribution(t *testing.T) {
	tests := []struct {
		name           string
		authentication *storytellerService.PersonalAccessTokenAuthentication
		wantActor      uint64
		wantCredential string
		wantReason     any
	}{
		{name: "expired", authentication: &storytellerService.PersonalAccessTokenAuthentication{
			UserID: 42, CredentialRef: "pat_public", DeniedReason: "expired",
		}, wantActor: 42, wantCredential: "pat_public", wantReason: "expired"},
		{name: "unknown"},
	}
	for _, test := range tests {
		t.Run(test.name, func(t *testing.T) {
			var emitted auditService.EventInput
			var requestContext auditService.RequestContext
			app := fiber.New(fiber.Config{ErrorHandler: func(ctx fiber.Ctx, err error) error {
				if response, ok := err.(output.CommonOutputInterface); ok {
					return ctx.SendStatus(response.HttpCode())
				}
				return err
			}})
			app.Use(storytellerAudit.NewRequestContext())
			app.Use(newMiddleware(
				func(string) (*storytellerService.PersonalAccessTokenAuthentication, error) {
					return test.authentication, errors.New("invalid token")
				},
				func(ctx context.Context, input auditService.EventInput) error {
					emitted = input
					requestContext, _ = auditService.RequestContextFrom(ctx)
					return nil
				},
			))
			app.Post("/storyteller-mcp", func(ctx fiber.Ctx) error { return ctx.SendStatus(http.StatusNoContent) })

			request := httptest.NewRequest(http.MethodPost, "/storyteller-mcp", nil)
			request.Header.Set(fiber.HeaderAuthorization, "Bearer secret")
			response, err := app.Test(request)
			require.NoError(t, err)
			require.Equal(t, http.StatusUnauthorized, response.StatusCode)
			require.Equal(t, "auth.pat.denied", emitted.Action)
			require.Equal(t, storytellerModel.AuditOutcomeDenied, emitted.Outcome)
			require.Equal(t, test.wantActor, requestContext.ActorUserID)
			require.Equal(t, test.wantCredential, requestContext.CredentialRef)
			require.Equal(t, test.wantReason, emitted.Summary["reason"])
		})
	}
}
