package nekomaid

import (
	"errors"
	"net/http"

	"faryne.dev/controller/helper"
	nekomaidEntity "faryne.dev/model/entity/nekomaid"
	"faryne.dev/service/nekomaid"
	"faryne.dev/service/output"
	"github.com/gofiber/fiber/v3"
)

// SubmitForbidden 作品頁的版權申告；不需登入，送出後回查詢用的 token
func SubmitForbidden(ctx fiber.Ctx) error {
	var input nekomaidEntity.ForbiddenSubmitRequest
	if err := helper.BindJSON(ctx, &input); err != nil {
		return err
	}
	result, err := nekomaid.SubmitForbidden(input, ctx.IP())
	if errors.Is(err, nekomaid.ErrForbiddenSubmitLimited) {
		return output.New(http.StatusTooManyRequests, "", nil, "申告次數太頻繁，請一小時後再試")
	}
	if err != nil {
		return forbiddenError(err)
	}
	return output.Success(result)
}

// ForbiddenSubmissionStatus 申請人用 token 查詢申告的審核狀態
func ForbiddenSubmissionStatus(ctx fiber.Ctx) error {
	status, err := nekomaid.ForbiddenSubmissionStatusByToken(ctx.Params("token"))
	if err != nil {
		return output.FromError(err)
	}
	return output.Success(status)
}
