package opendata

import (
	"time"

	"faryne.dev/service/output"
	"faryne.dev/service/twse"
	"github.com/gofiber/fiber/v3"
)

// TwseEtfCodeList lists ETF codes.
// @Summary List TWSE ETF codes
// @Tags OpenData TWSE
// @Produce json
// @Success 200 {object} output.CommonOutput
// @Failure 503 {object} output.CommonOutput
// @Router /opendata/financial/twse/code_list [get]
func TwseEtfCodeList(ctx fiber.Ctx) error {
	s, err := twse.GetCodeList()
	if err != nil {
		return output.ExternalServiceError(err)
	}
	return output.Success(s)
}

// TwseUpcomingExETFByDate lists upcoming ETF ex-dividend events by date.
// @Summary List upcoming ETF ex-dividend events
// @Tags OpenData TWSE
// @Produce json
// @Param date query string true "Date in YYYY-MM-DD"
// @Success 200 {object} output.CommonOutput
// @Failure 400 {object} output.CommonOutput
// @Failure 500 {object} output.CommonOutput
// @Router /opendata/financial/twse/upcoming/by_date [get]
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

// TwseEtfShareInfo returns historical ETF dividend share data.
// @Summary Get ETF share history
// @Tags OpenData TWSE
// @Produce json
// @Param code path string true "ETF code"
// @Success 200 {object} output.CommonOutput
// @Failure 503 {object} output.CommonOutput
// @Router /opendata/financial/twse/{code}/share_info [get]
func TwseEtfShareInfo(ctx fiber.Ctx) error {
	code := ctx.Params("code", "")
	s, err := twse.GetHistoryDivByCode(code)
	if err != nil {
		return output.ExternalServiceError(err)
	}
	return output.Success(s)
}

// TwseEtfTicker returns ETF ticker records.
// @Summary Get ETF ticker records
// @Tags OpenData TWSE
// @Produce json
// @Param code path string true "ETF code"
// @Param start_date query string true "Start date in YYYY-MM-DD"
// @Param end_date query string true "End date in YYYY-MM-DD"
// @Success 200 {object} output.CommonOutput
// @Failure 400 {object} output.CommonOutput
// @Failure 500 {object} output.CommonOutput
// @Router /opendata/financial/twse/{code}/ticker [get]
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
