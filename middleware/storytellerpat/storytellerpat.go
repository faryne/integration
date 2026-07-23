package storytellerpat

import (
	"errors"
	"strings"

	"faryne.dev/service/output"
	storytellerService "faryne.dev/service/storyteller"
	"github.com/gofiber/fiber/v3"
)

const LocalUserID = "storyteller_pat_user_id"

// New 驗證 `Authorization: Bearer <token>`，供外部工具（如 MCP client）以
// Personal Access Token 存取，取代需要瀏覽器 session 的 authsession。
func New() fiber.Handler {
	return func(ctx fiber.Ctx) error {
		token := extractBearerToken(ctx.Get(fiber.HeaderAuthorization))
		if token == "" {
			return output.Unauthorized(errors.New("Authorization bearer token is required"))
		}
		userID, err := storytellerService.NewService().AuthenticatePersonalAccessToken(token)
		if err != nil {
			return output.Unauthorized(err)
		}
		ctx.Locals(LocalUserID, userID)
		return ctx.Next()
	}
}

func UserID(ctx fiber.Ctx) uint64 {
	userID, _ := ctx.Locals(LocalUserID).(uint64)
	return userID
}

func extractBearerToken(header string) string {
	const prefix = "Bearer "
	if !strings.HasPrefix(header, prefix) {
		return ""
	}
	return strings.TrimSpace(strings.TrimPrefix(header, prefix))
}
