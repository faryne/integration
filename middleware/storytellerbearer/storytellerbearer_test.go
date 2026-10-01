package storytellerbearer

import (
	"context"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"

	storytellerAudit "faryne.dev/middleware/storytelleraudit"
	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/service/output"
	auditService "faryne.dev/service/storytelleraudit"
	"github.com/gofiber/fiber/v3"
	"github.com/stretchr/testify/require"
)

func TestDeniedBearerAttribution(t *testing.T) {
	tests := []struct {
		name           string
		authentication *Credential
		wantAction     string
		wantActor      uint64
		wantCredential string
		wantReason     any
	}{
		{name: "expired pat", authentication: &Credential{
			UserID: 42, CredentialRef: "pat_public", DeniedReason: "expired", Method: storytellerModel.AuditAuthMethodPAT,
		}, wantAction: "auth.pat.denied", wantActor: 42, wantCredential: "pat_public", wantReason: "expired"},
		{name: "expired oauth", authentication: &Credential{
			UserID: 7, CredentialRef: "oag_public", DeniedReason: "expired", Method: storytellerModel.AuditAuthMethodOAuth,
		}, wantAction: "auth.oauth.denied", wantActor: 7, wantCredential: "oag_public", wantReason: "expired"},
		{name: "unknown", wantAction: "auth.pat.denied"},
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
				func(string) (*Credential, error) {
					return test.authentication, errors.New("invalid token")
				},
				func(ctx context.Context, input auditService.EventInput) error {
					emitted = input
					requestContext, _ = auditService.RequestContextFrom(ctx)
					return nil
				},
				"https://steamloom.test/.well-known/oauth-protected-resource",
			))
			app.Post("/storyteller-mcp", func(ctx fiber.Ctx) error { return ctx.SendStatus(http.StatusNoContent) })

			request := httptest.NewRequest(http.MethodPost, "/storyteller-mcp", nil)
			request.Header.Set(fiber.HeaderAuthorization, "Bearer secret")
			response, err := app.Test(request)
			require.NoError(t, err)
			require.Equal(t, http.StatusUnauthorized, response.StatusCode)
			require.Equal(t, test.wantAction, emitted.Action)
			require.Contains(t, response.Header.Get(fiber.HeaderWWWAuthenticate), `resource_metadata="https://steamloom.test/.well-known/oauth-protected-resource"`)
			require.Equal(t, storytellerModel.AuditOutcomeDenied, emitted.Outcome)
			require.Equal(t, test.wantActor, requestContext.ActorUserID)
			require.Equal(t, test.wantCredential, requestContext.CredentialRef)
			require.Equal(t, test.wantReason, emitted.Summary["reason"])
		})
	}
}
