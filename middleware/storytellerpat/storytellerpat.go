package storytellerpat

import (
	"errors"
	"strings"

	storytellerAudit "faryne.dev/middleware/storytelleraudit"
	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/service/output"
	storytellerService "faryne.dev/service/storyteller"
	auditService "faryne.dev/service/storytelleraudit"
	"github.com/gofiber/fiber/v3"
)

const (
	LocalUserID     = "storyteller_pat_user_id"
	LocalTokenLabel = "storyteller_pat_token_label"
	LocalPublicID   = "storyteller_pat_public_id"
)

// New 驗證 `Authorization: Bearer <token>`，供外部工具（如 MCP client）以
// Personal Access Token 存取，取代需要瀏覽器 session 的 authsession。
func New() fiber.Handler {
	return func(ctx fiber.Ctx) error {
		token := extractBearerToken(ctx.Get(fiber.HeaderAuthorization))
		if token == "" {
			return output.Unauthorized(errors.New("Authorization bearer token is required"))
		}
		userID, label, publicID, err := storytellerService.NewService().AuthenticatePersonalAccessToken(token)
		if err != nil {
			return output.Unauthorized(err)
		}
		ctx.Locals(LocalUserID, userID)
		ctx.Locals(LocalTokenLabel, label)
		ctx.Locals(LocalPublicID, publicID)
		storytellerAudit.Set(ctx, func(audit *auditService.RequestContext) {
			audit.ActorUserID = userID
			audit.AuthMethod = storytellerModel.AuditAuthMethodPAT
			audit.CredentialRef = publicID
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
