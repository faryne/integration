package joyu

import (
	"errors"
	"net/http"
	"strconv"

	"faryne.dev/controller/helper"
	"faryne.dev/middleware/joyuauth"
	avEntity "faryne.dev/model/entity/opendata/av"
	"faryne.dev/service/av"
	"faryne.dev/service/output"

	"github.com/gofiber/fiber/v3"
)

// joyu 女優股市的個人 API：只限 Google 帳號（匿名帳號可以無限開，等於可以無限印錢），匿名一律 403

const (
	customCodeMarketGoogleOnly   output.CustomCode = "403501"
	customCodeMarketPriceChanged output.CustomCode = "409501"
	customCodeMarketPriceLimit   output.CustomCode = "400501"
	customCodeMarketCash         output.CustomCode = "400502"
	customCodeMarketShares       output.CustomCode = "400503"
	customCodeMarketNotTradable  output.CustomCode = "400504"
	customCodeMarketRateLimited  output.CustomCode = "429007"
)

// marketUID 已登入且不是匿名帳號才回 uid
func marketUID(ctx fiber.Ctx) (string, error) {
	t := joyuauth.Token(ctx)
	if t.Provider == "anonymous" {
		return "", output.New(http.StatusForbidden, customCodeMarketGoogleOnly, nil, "google account required")
	}
	return t.UID, nil
}

// marketError 交易失敗的原因轉成各自的錯誤碼，前端照錯誤碼顯示訊息
func marketError(err error) error {
	codes := []struct {
		err    error
		status int
		code   output.CustomCode
	}{
		{av.ErrMarketPriceChanged, http.StatusConflict, customCodeMarketPriceChanged},
		{av.ErrMarketPriceLimit, http.StatusBadRequest, customCodeMarketPriceLimit},
		{av.ErrMarketCash, http.StatusBadRequest, customCodeMarketCash},
		{av.ErrMarketShares, http.StatusBadRequest, customCodeMarketShares},
		{av.ErrMarketNotTradable, http.StatusBadRequest, customCodeMarketNotTradable},
		{av.ErrMarketRateLimited, http.StatusTooManyRequests, customCodeMarketRateLimited},
		{av.ErrMarketInvalid, http.StatusBadRequest, ""},
	}
	for _, c := range codes {
		if errors.Is(err, c.err) {
			return output.New(c.status, c.code, nil, err.Error())
		}
	}
	return output.FromError(err)
}

// MarketWallet 我的資產（第一次進股市時開戶，入帳 100000 單位）
// @Summary joyu market wallet
// @Tags Joyu
// @Produce json
// @Security BearerAuth
// @Success 200 {object} output.CommonOutput
// @Failure 403 {object} output.CommonOutput
// @Router /joyu/me/market/wallet [get]
func MarketWallet(ctx fiber.Ctx) error {
	uid, err := marketUID(ctx)
	if err != nil {
		return err
	}
	out, err := av.MarketWalletFor(uid)
	if err != nil {
		return marketError(err)
	}
	return output.Success(out)
}

// MarketQuote 報價：買或賣幾股要付／會拿多少、成交後股價、現在最多能買／賣幾股
// @Summary joyu market quote
// @Tags Joyu
// @Produce json
// @Security BearerAuth
// @Param code path string true "Stock code"
// @Param side query string true "buy / sell"
// @Param shares query int false "Shares"
// @Success 200 {object} output.CommonOutput
// @Router /joyu/me/market/stocks/{code}/quote [get]
func MarketQuote(ctx fiber.Ctx) error {
	uid, err := marketUID(ctx)
	if err != nil {
		return err
	}
	shares, _ := strconv.ParseInt(ctx.Query("shares"), 10, 64)
	out, err := av.MarketQuoteFor(uid, ctx.Params("code"), ctx.Query("side"), shares)
	if err != nil {
		return marketError(err)
	}
	return output.Success(out)
}

// MarketTrade 下單；limit 帶報價時的 total_cents，價格在報價後變了就回 409501
// @Summary joyu market trade
// @Tags Joyu
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param code path string true "Stock code"
// @Param body body avEntity.MarketTradeRequest true "Trade"
// @Success 200 {object} output.CommonOutput
// @Router /joyu/me/market/stocks/{code}/trades [post]
func MarketTrade(ctx fiber.Ctx) error {
	uid, err := marketUID(ctx)
	if err != nil {
		return err
	}
	var req avEntity.MarketTradeRequest
	if err := helper.BindJSON(ctx, &req); err != nil {
		return err
	}
	out, err := av.MarketTrade(uid, ctx.Params("code"), req)
	if err != nil {
		return marketError(err)
	}
	return output.Success(out)
}

// MarketTrades 我的成交紀錄（新的在前，一頁 30 筆）
// @Summary joyu market trade history
// @Tags Joyu
// @Produce json
// @Security BearerAuth
// @Param page query int false "Page"
// @Success 200 {object} output.CommonOutput
// @Router /joyu/me/market/trades [get]
func MarketTrades(ctx fiber.Ctx) error {
	uid, err := marketUID(ctx)
	if err != nil {
		return err
	}
	page, _ := strconv.Atoi(ctx.Query("page"))
	rows, total, err := av.MarketTradesFor(uid, page)
	if err != nil {
		return marketError(err)
	}
	return output.Success(fiber.Map{"data": rows, "total": total})
}
