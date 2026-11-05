package nekomaid

import (
	"errors"
	"net/http"

	"faryne.dev/controller/helper"
	nekomaidEntity "faryne.dev/model/entity/nekomaid"
	serviceHelper "faryne.dev/service/helper"
	"faryne.dev/service/nekomaid"
	"faryne.dev/service/output"
	"github.com/gofiber/fiber/v3"
)

// SubmitForbidden 作品頁的版權申告；不需登入，送出後回送出者 IP 的 hash（查詢網址用）
func SubmitForbidden(ctx fiber.Ctx) error {
	var input nekomaidEntity.ForbiddenSubmitRequest
	if err := helper.BindJSON(ctx, &input); err != nil {
		return err
	}
	result, err := nekomaid.SubmitForbidden(input, helper.ClientIP(ctx))
	switch {
	case errors.Is(err, nekomaid.ErrForbiddenSubmitLimited):
		return output.New(http.StatusTooManyRequests, "", nil, "申告次數太頻繁，請一小時後再試")
	case errors.Is(err, nekomaid.ErrIPHashSecretMissing):
		return output.InternalServiceError(err)
	case err != nil:
		return forbiddenError(err)
	}
	return output.Success(result)
}

// PublicForbiddenSubmissions 公開的版權申告處理結果（neko.maid.tw/copyright-claim）；不含 email、IP、說明
func PublicForbiddenSubmissions(ctx fiber.Ctx) error {
	return publicForbiddenSubmissions(ctx, "")
}

// ForbiddenSubmissionsByHash 同一 IP 送出的申告（neko.maid.tw/copyright-claim/:hash）
func ForbiddenSubmissionsByHash(ctx fiber.Ctx) error {
	return publicForbiddenSubmissions(ctx, ctx.Params("hash"))
}

func publicForbiddenSubmissions(ctx fiber.Ctx, ipHash string) error {
	var input nekomaidEntity.ForbiddenSubmissionPublicRequest
	if err := helper.BindQuery(ctx, &input); err != nil {
		return err
	}
	rows, total, err := nekomaid.ListPublicForbiddenSubmissions(input, ipHash)
	if err != nil {
		return output.FromError(err)
	}
	return output.Success(serviceHelper.ResultPaginate(ctx, rows, total))
}
