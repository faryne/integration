package storytellerpat

import (
	"context"
	"errors"
	"strings"

	storytellerAudit "faryne.dev/middleware/storytelleraudit"
	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/service/log"
	"faryne.dev/service/output"
	storytellerService "faryne.dev/service/storyteller"
	auditService "faryne.dev/service/storytelleraudit"
	"github.com/gofiber/fiber/v3"
	"go.uber.org/zap"
)

const (
	LocalUserID     = "storyteller_pat_user_id"
	LocalTokenLabel = "storyteller_pat_token_label"
	LocalPublicID   = "storyteller_pat_public_id"
)

// New 驗證 `Authorization: Bearer <token>`，供外部工具（如 MCP client）以
// Personal Access Token 存取，取代需要瀏覽器 session 的 authsession。
func New() fiber.Handler {
	return newMiddleware(storytellerService.NewService().AuthenticatePersonalAccessToken, auditService.Emit)
}

type authenticateFunc func(string) (*storytellerService.PersonalAccessTokenAuthentication, error)
type emitFunc func(context.Context, auditService.EventInput) error

func newMiddleware(authenticate authenticateFunc, emit emitFunc) fiber.Handler {
	return func(ctx fiber.Ctx) error {
		token := extractBearerToken(ctx.Get(fiber.HeaderAuthorization))
		if token == "" {
			return output.Unauthorized(errors.New("Authorization bearer token is required"))
		}
		authentication, err := authenticate(token)
		if err != nil {
			storytellerAudit.Set(ctx, func(audit *auditService.RequestContext) {
				audit.AuthMethod = storytellerModel.AuditAuthMethodPAT
				if authentication != nil {
					audit.ActorUserID = authentication.UserID
					audit.CredentialRef = authentication.CredentialRef
				}
			})
			summary := auditService.FailureSummary(fiber.StatusUnauthorized, string(output.CustomCodeUnauthorized))
			if authentication != nil && authentication.DeniedReason != "" {
				summary["reason"] = authentication.DeniedReason
			}
			if emitErr := emit(ctx.Context(), auditService.EventInput{
				Action: "auth.pat.denied", Outcome: storytellerModel.AuditOutcomeDenied,
				Summary: summary,
			}); emitErr != nil {
				log.Logger().Error("Emit denied storyteller PAT audit event failed", zap.Error(emitErr))
			}
			return output.Unauthorized(err)
		}
		ctx.Locals(LocalUserID, authentication.UserID)
		ctx.Locals(LocalTokenLabel, authentication.Label)
		ctx.Locals(LocalPublicID, authentication.CredentialRef)
		storytellerAudit.Set(ctx, func(audit *auditService.RequestContext) {
			audit.ActorUserID = authentication.UserID
			audit.AuthMethod = storytellerModel.AuditAuthMethodPAT
			audit.CredentialRef = authentication.CredentialRef
		})
		return ctx.Next()
	}
}

func UserID(ctx fiber.Ctx) uint64 {
	userID, _ := ctx.Locals(LocalUserID).(uint64)
	return userID
}

func TokenLabel(ctx fiber.Ctx) string {
	label, _ := ctx.Locals(LocalTokenLabel).(string)
	return label
}

func extractBearerToken(header string) string {
	const prefix = "Bearer "
	if !strings.HasPrefix(header, prefix) {
		return ""
	}
	return strings.TrimSpace(strings.TrimPrefix(header, prefix))
}
