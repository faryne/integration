package opendata

import (
	"faryne.dev/middleware/authsession"
	etfService "faryne.dev/service/etf"
	"faryne.dev/service/output"
	"github.com/gofiber/fiber/v3"
)

// TwseEtfFavorites lists the logged-in user's favorited TWSE ETF codes.
// @Summary List favorited TWSE ETF codes
// @Tags OpenData TWSE
// @Produce json
// @Success 200 {object} output.CommonOutput
// @Failure 401 {object} output.CommonOutput
// @Failure 500 {object} output.CommonOutput
// @Router /opendata/financial/twse/favorites [get]
func TwseEtfFavorites(ctx fiber.Ctx) error {
	rows, err := etfService.ListFavorites(authsession.Session(ctx).UserId)
	if err != nil {
		return output.DBError(err)
	}
	return output.Success(rows)
}

// TwseEtfFavoritesBatch returns the logged-in user's favorited TWSE ETF codes
// together with each one's dividend history and saved profit-calculator
// transactions in a single response, instead of the caller having to fan out
// one request per favorite for each of those two resources.
// @Summary Get favorited TWSE ETFs with dividend history and saved transactions
// @Tags OpenData TWSE
// @Produce json
// @Success 200 {object} output.CommonOutput
// @Failure 401 {object} output.CommonOutput
// @Failure 500 {object} output.CommonOutput
// @Router /opendata/financial/twse/favorites/batch [get]
func TwseEtfFavoritesBatch(ctx fiber.Ctx) error {
	rows, err := etfService.ListFavoritesBatch(authsession.Session(ctx).UserId)
	if err != nil {
		return output.DBError(err)
	}
	return output.Success(rows)
}

// CreateTwseEtfFavorite adds an ETF code to the logged-in user's favorites.
// @Summary Add a TWSE ETF to favorites
// @Tags OpenData TWSE
// @Produce json
// @Param code path string true "ETF code"
// @Success 200 {object} output.CommonOutput
// @Failure 401 {object} output.CommonOutput
// @Failure 400 {object} output.CommonOutput
// @Router /opendata/financial/twse/{code}/favorite [post]
func CreateTwseEtfFavorite(ctx fiber.Ctx) error {
	row, err := etfService.AddFavorite(authsession.Session(ctx).UserId, ctx.Params("code"))
	if err != nil {
		return output.BadRequest(err)
	}
	return output.Success(row)
}

// DeleteTwseEtfFavorite removes an ETF code from the logged-in user's favorites.
// @Summary Remove a TWSE ETF from favorites
// @Tags OpenData TWSE
// @Produce json
// @Param code path string true "ETF code"
// @Success 200 {object} output.CommonOutput
// @Failure 401 {object} output.CommonOutput
// @Failure 400 {object} output.CommonOutput
// @Router /opendata/financial/twse/{code}/favorite [delete]
func DeleteTwseEtfFavorite(ctx fiber.Ctx) error {
	if err := etfService.RemoveFavorite(authsession.Session(ctx).UserId, ctx.Params("code")); err != nil {
		return output.BadRequest(err)
	}
	return output.Success(map[string]bool{"deleted": true})
}
