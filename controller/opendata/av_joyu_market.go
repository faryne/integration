package opendata

import (
	"faryne.dev/service/av"
	"faryne.dev/service/output"
	"github.com/gofiber/fiber/v3"
)

// AvMarketStocks joyu.fyi 女優股市總覽：上市中的全部
// @Summary joyu actress market stocks
// @Tags OpenData AV
// @Produce json
// @Success 200 {object} output.CommonOutput
// @Failure 500 {object} output.CommonOutput
// @Router /opendata/av/market/stocks [get]
func AvMarketStocks(ctx fiber.Ctx) error {
	out, err := av.MarketStocks()
	if err != nil {
		return output.FromError(err)
	}
	return output.Success(out)
}

// AvMarketStock joyu.fyi 女優股市個股頁
// @Summary joyu actress market stock
// @Tags OpenData AV
// @Produce json
// @Param code path string true "Stock code, e.g. J0001"
// @Success 200 {object} output.CommonOutput
// @Failure 404 {object} output.CommonOutput
// @Router /opendata/av/market/stocks/{code} [get]
func AvMarketStock(ctx fiber.Ctx) error {
	out, err := av.MarketStock(ctx.Params("code"))
	if err != nil {
		return output.FromError(err)
	}
	return output.Success(out)
}
