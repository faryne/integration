package opendata

import (
	"faryne.dev/middleware/authsession"
	etfService "faryne.dev/service/etf"
	"faryne.dev/service/output"
	"github.com/gofiber/fiber/v3"
)

// TwseEtfFavoritesRealtimePrices returns the logged-in user's favorited ETF codes,
// each with a live intraday price (when available) plus its latest close price
// as a permanent fallback. The frontend can poll this endpoint at any time — it
// doesn't need to know whether the market is currently open.
// @Summary Get favorited ETFs' real-time (or latest close) prices
// @Tags OpenData TWSE
// @Produce json
// @Success 200 {object} output.CommonOutput
// @Failure 401 {object} output.CommonOutput
// @Failure 500 {object} output.CommonOutput
// @Router /opendata/financial/twse/favorites/realtime_price [get]
func TwseEtfFavoritesRealtimePrices(ctx fiber.Ctx) error {
	rows, err := etfService.GetFavoritesRealtimePrices(authsession.Session(ctx).UserId)
	if err != nil {
		return output.DBError(err)
	}
	return output.Success(rows)
}
