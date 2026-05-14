package opendata

import (
	"time"

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

func TwseUpcomingExETFByDate(ctx fiber.Ctx) error {
	d := ctx.Query("date", "")
	if _, err := time.Parse(time.DateOnly, d); err != nil {
		return output.BadRequest(err)
	}
	rows, err := twse.GetUpcomingETFEx(d)
	if err != nil {
		return output.DBError(err)
	}
	return output.Success(rows)
}

func TwseEtfShareInfo(ctx fiber.Ctx) error {
	code := ctx.Params("code", "")
	s, err := twse.GetHistoryDivByCode(code)
	if err != nil {
		return output.ExternalServiceError(err)
	}
	return output.Success(s)
}

func TwseEtfTicker(ctx fiber.Ctx) error {
	code := ctx.Params("code", "")
	startDate := ctx.Query("start_date", "")
	endDate := ctx.Query("end_date", "")
	if _, err := time.Parse(time.DateOnly, startDate); err != nil {
		return output.BadRequest(err)
	}
	if _, err := time.Parse(time.DateOnly, endDate); err != nil {
		return output.BadRequest(err)
	}
	rows, err := twse.GetETFTicker(code, startDate, endDate)
	if err != nil {
		return output.DBError(err)
	}
	return output.Success(rows)
}
