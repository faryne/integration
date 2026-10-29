package opendata

import (
	"errors"

	"github.com/gofiber/fiber/v3"

	"faryne.dev/controller/helper"
	model "faryne.dev/model/entity/opendata/twstats"
	"faryne.dev/service/output"
	"faryne.dev/service/twstats"
)

// TwStatsAreaProfile 縣市健檢：該縣市在全部指標的數值、22 縣市名次與年增率
func TwStatsAreaProfile(ctx fiber.Ctx) error {
	var req model.AreaProfileRequest
	if err := helper.BindQuery(ctx, &req); err != nil {
		return err
	}
	result, err := twstats.Default.AreaProfile(ctx.Context(), ctx.Params("area"), req)
	if err != nil {
		return twStatsError(err)
	}
	return output.Success(result)
}

// TwStatsMovers 年度變化榜：全國年增率榜＋縣市名次變化榜
func TwStatsMovers(ctx fiber.Ctx) error {
	var req model.MoversRequest
	if err := helper.BindQuery(ctx, &req); err != nil {
		return err
	}
	result, err := twstats.Default.Movers(ctx.Context(), req)
	if err != nil {
		return twStatsError(err)
	}
	return output.Success(result)
}

// twStatsError 資料方塊尚未載入回 503，其餘交給 FromError（驗證錯誤 400）
func twStatsError(err error) error {
	switch {
	case errors.Is(err, twstats.ErrNotReady):
		return output.ExternalServiceError(err)
	case errors.Is(err, twstats.ErrIndicatorNotFound):
		return output.NotFound(err)
	default:
		return output.FromError(err)
	}
}
