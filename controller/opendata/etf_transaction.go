package opendata

import (
	"faryne.dev/middleware/authsession"
	etfModel "faryne.dev/model/entity/opendata/etf"
	etfService "faryne.dev/service/etf"
	"faryne.dev/service/output"
	"github.com/gofiber/fiber/v3"
)

// TwseEtfSavedTransactions returns the logged-in user's saved profit-calculator
// transaction records for a TWSE ETF code. Returns an empty list if none saved yet.
// @Summary Get saved profit-calculator transactions for a TWSE ETF
// @Tags OpenData TWSE
// @Produce json
// @Param code path string true "ETF code"
// @Success 200 {object} output.CommonOutput
// @Failure 401 {object} output.CommonOutput
// @Failure 500 {object} output.CommonOutput
// @Router /opendata/financial/twse/{code}/transactions [get]
func TwseEtfSavedTransactions(ctx fiber.Ctx) error {
	rows, err := etfService.GetSavedTransactions(authsession.Session(ctx).UserId, ctx.Params("code"))
	if err != nil {
		return output.DBError(err)
	}
	return output.Success(rows)
}

// SaveTwseEtfSavedTransactions overwrites the logged-in user's saved
// profit-calculator transaction records for a TWSE ETF code.
// @Summary Save profit-calculator transactions for a TWSE ETF
// @Tags OpenData TWSE
// @Accept json
// @Produce json
// @Param code path string true "ETF code"
// @Param body body etfModel.SaveTransactionsRequest true "Transaction records"
// @Success 200 {object} output.CommonOutput
// @Failure 401 {object} output.CommonOutput
// @Failure 400 {object} output.CommonOutput
// @Router /opendata/financial/twse/{code}/transactions [put]
func SaveTwseEtfSavedTransactions(ctx fiber.Ctx) error {
	var input etfModel.SaveTransactionsRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	row, err := etfService.SaveTransactions(authsession.Session(ctx).UserId, ctx.Params("code"), input.Records)
	if err != nil {
		return output.BadRequest(err)
	}
	return output.Success(row)
}
