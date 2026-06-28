package opendata

import (
	"github.com/gofiber/fiber/v3"

	"faryne.dev/controller/helper"
	taipowerModel "faryne.dev/model/entity/opendata/taipower"
	serviceHelper "faryne.dev/service/helper"
	"faryne.dev/service/output"
	taipowerService "faryne.dev/service/taipower"
)

// TaipowerNeighbor searches Taipower neighborhood assistance records.
// @Summary Search Taipower neighborhood assistance records
// @Tags OpenData Taipower
// @Produce json
// @Param year path int false "Gregorian year"
// @Param month path int false "Month"
// @Param keyword query string false "Summary, approval reason, unit, or city keyword"
// @Param yearMonths query string false "Selected months separated by commas, each in YYYY-MM"
// @Param yearMonthFrom query string false "Start month in YYYY-MM"
// @Param yearMonthTo query string false "End month in YYYY-MM"
// @Param costFrom query number false "Minimum cost"
// @Param costTo query number false "Maximum cost"
// @Param sort query string false "date_desc, cash_asc, or cash_desc"
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
	if err := helper.BindQuery(ctx, &req); err != nil {
		return err
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
	currentOffset := (req.PageValue() - 1) * req.PerPageValue()
	if cursor, err := serviceHelper.DecodeESCursor(req.Cursor); err != nil {
		return output.BadRequest(err)
	} else if cursor != nil {
		currentOffset = cursor.Offset
	}
	var nextSearchAfter []any
	if len(raw.Hits.Hits) > 0 {
		nextSearchAfter = raw.Hits.Hits[len(raw.Hits.Hits)-1].Sort
	}
	pagination, err := serviceHelper.PaginateByES(ctx, serviceHelper.ESPaginateInput[[]taipowerModel.Neighbor]{
		Data:            rows,
		Total:           raw.Hits.Total.Value,
		PerPage:         req.PerPageValue(),
		CurrentCursor:   req.Cursor,
		CurrentOffset:   currentOffset,
		NextSearchAfter: nextSearchAfter,
		RowsCount:       int64(len(rows)),
	})
	if err != nil {
		return output.ESError(err)
	}
	return output.Success(taipowerModel.NeighborSearchOutput{
		CommonESPaginationOutput: pagination,
		TotalCash:                totalCash,
	})
}
