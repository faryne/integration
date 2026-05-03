package opendata

import (
	"faryne.dev/service/output"
	"faryne.dev/service/twse"
	"github.com/gofiber/fiber/v3"
)

func TwseEtfCodeList(ctx fiber.Ctx) error {
	s, err := twse.GetCodeList()
	if err != nil {
		return output.ExternalServiceError(err)
	}
	return output.Success(s)
}

func TwseEtfShareInfo(ctx fiber.Ctx) error {
	code := ctx.Params("code", "")
	s, err := twse.GetHistoryDivByCode(code)
	if err != nil {
		return output.ExternalServiceError(err)
	}
	return output.Success(s)
}
