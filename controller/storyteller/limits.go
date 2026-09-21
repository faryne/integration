package storyteller

import (
	"faryne.dev/middleware/authsession"
	"faryne.dev/service/output"
	"faryne.dev/service/storyteller"
	"github.com/gofiber/fiber/v3"
)

// AccountLimits 給前端在建立專案／上傳資產前先查一次帳號配額，決定按鈕要不要
// disabled，不用等後端拒絕才知道超過上限。
func AccountLimits(ctx fiber.Ctx) error {
	row, err := storyteller.NewService().AccountLimits(authsession.Session(ctx).UserId)
	if err != nil {
		return output.DBError(err)
	}
	return output.Success(row)
}
