package opendata

import (
	taipowerModel "faryne.dev/model/entity/opendata/taipower"
	"faryne.dev/service/helper"
	"faryne.dev/service/output"
	taipowerService "faryne.dev/service/taipower"
	"github.com/gofiber/fiber/v3"
)

// TaipowerNeighbor searches Taipower neighborhood assistance records.
// @Summary Search Taipower neighborhood assistance records
// @Tags OpenData Taipower
// @Produce json
// @Param year path int false "Gregorian year"
// @Param month path int false "Month"
// @Param keyword query string false "Summary, approval reason, unit, or city keyword"
// @Param yearMonthFrom query string false "Start month in YYYY-MM"
// @Param yearMonthTo query string false "End month in YYYY-MM"
// @Param costFrom query number false "Minimum cost"
// @Param costTo query number false "Maximum cost"
// @Param page query int false "Page number"
// @Param per_page query int false "Items per page, maximum 100"
// @Success 200 {object} output.CommonOutput
// @Failure 400 {object} output.CommonOutput
// @Failure 500 {object} output.CommonOutput
func TaipowerNeighbor(ctx fiber.Ctx) error {
	return searchTaipowerNeighbor(ctx, "", "")
}

func TaipowerNeighborByCityArea(ctx fiber.Ctx) error {
	return searchTaipowerNeighbor(ctx, ctx.Params("cityarea"), "")
}

func TaipowerNeighborByUnit(ctx fiber.Ctx) error {
	return searchTaipowerNeighbor(ctx, "", ctx.Params("unit"))
}

func searchTaipowerNeighbor(ctx fiber.Ctx, cityArea string, unit string) error {
	var req taipowerModel.NeighborSearchRequest
	if err := ctx.Bind().Query(&req); err != nil {
		return output.BadRequest(err)
	}

	filter, err := taipowerService.ParseNeighborPath(ctx.Params("year"), ctx.Params("month"))
	if err != nil {
		return output.BadRequest(err)
	}
	filter.CityArea = cityArea
	filter.Unit = unit
	if err := taipowerService.ValidateNeighborSearch(req, filter); err != nil {
		return output.BadRequest(err)
	}
	raw, rows, err := taipowerService.SearchNeighbors(req, filter)
	if err != nil {
		return output.ESError(err)
	}

	totalCash := float64(0)
	if aggregation, ok := raw.Aggregations["total_cash"]; ok && aggregation.Value != nil {
		totalCash = *aggregation.Value
	}
	return output.Success(taipowerModel.NeighborSearchOutput{
		CommonPaginationOutput: helper.ResultPaginate(ctx, rows, raw.Hits.Total.Value),
		TotalCash:              totalCash,
	})
}
