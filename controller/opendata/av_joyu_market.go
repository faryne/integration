package opendata

import (
	"strconv"

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

// AvMarketHistory joyu.fyi 女優股市個股走勢：最近 days 天的每日收盤（預設 90，最多 365）
// @Summary joyu actress market stock price history
// @Tags OpenData AV
// @Produce json
// @Param code path string true "Stock code"
// @Param days query int false "Days (1-365, default 90)"
// @Success 200 {object} output.CommonOutput
// @Failure 404 {object} output.CommonOutput
// @Router /opendata/av/market/stocks/{code}/history [get]
func AvMarketHistory(ctx fiber.Ctx) error {
	days, err := strconv.Atoi(ctx.Query("days", "90"))
	if err != nil {
		days = 90
	}
	out, err := av.MarketHistory(ctx.Params("code"), days)
	if err != nil {
		return output.FromError(err)
	}
	return output.Success(out)
}

// AvMarketLeaderboard joyu.fyi 女優股市排行榜：總資產前 50 名（5 分鐘更新一次）
// @Summary joyu actress market leaderboard
// @Tags OpenData AV
// @Produce json
// @Success 200 {object} output.CommonOutput
// @Router /opendata/av/market/leaderboard [get]
func AvMarketLeaderboard(ctx fiber.Ctx) error {
	out, err := av.MarketLeaderboard()
	if err != nil {
		return output.FromError(err)
	}
	return output.Success(out)
}
