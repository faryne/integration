package opendata

import (
	"faryne.dev/model/entity/opendata/ntpcfd"
	ntpcfdRepo "faryne.dev/repository/ntpcfd"
	fdService "faryne.dev/service/fire_department"
	"faryne.dev/service/helper"
	"faryne.dev/service/output"
	"github.com/gofiber/fiber/v3"
	"net/url"
)

// FDRealtime returns realtime fire-department events.
// @Summary Get realtime fire-department events
// @Tags OpenData Fire Department
// @Produce json
// @Success 200 {object} output.CommonOutput
// @Failure 503 {object} output.CommonOutput
// @Router /opendata/fd/realtime_events [get]
func FDRealtime(ctx fiber.Ctx) error {
	eventsNewTaipei, err := fdService.NewTaipei()
	if err != nil {
		return output.ExternalServiceError(err)
	}
	eventsTaipei, err := fdService.Taipei()
	if err != nil {
		return output.ExternalServiceError(err)
	}
	// Key 與前端的 TWArea 一致
	return output.Success(map[string][]fdService.Event{
		"Taipei":    eventsTaipei,
		"NewTaipei": eventsNewTaipei,
	})
}

// FetchNtpcFDEvents searches New Taipei fire-department events.
// @Summary Search New Taipei fire-department events
// @Tags OpenData Fire Department
// @Produce json
// @Param service_type query string false "Service type"
// @Param service_unit query string false "Service unit"
// @Param service_start_time query string false "Service start date in YYYY-MM-DD"
// @Param service_end_time query string false "Service end date in YYYY-MM-DD"
// @Param page query int false "Page number"
// @Param per_page query int false "Rows per page"
// @Success 200 {object} output.CommonOutput
// @Failure 400 {object} output.CommonOutput
// @Failure 500 {object} output.CommonOutput
// @Router /opendata/fd [get]
func FetchNtpcFDEvents(ctx fiber.Ctx) error {
	var req ntpcfd.NTPCFDEventRequest
	if err := ctx.Bind().Query(&req); err != nil {
		return output.BadRequest(err)
	}
	resp, err := helper.Paginate(ctx, func(page int64, perPage int64, params url.Values) (helper.PaginateCallbackResponse[[]ntpcfd.NTPCFDEvent], error) {
		rows, total, err := ntpcfdRepo.FetchEvents(req, page, perPage)
		return helper.PaginateCallbackResponse[[]ntpcfd.NTPCFDEvent]{
			Data:  rows,
			Total: total,
		}, err
	})
	if err != nil {
		return output.DBError(err)
	}
	return output.Success(resp)
}

// FetchNtpcFDUnits lists New Taipei fire-department units.
// @Summary List New Taipei fire-department units
// @Tags OpenData Fire Department
// @Produce json
// @Success 200 {object} output.CommonOutput
// @Failure 500 {object} output.CommonOutput
// @Router /opendata/fd/units [get]
func FetchNtpcFDUnits(ctx fiber.Ctx) error {
	units, err := ntpcfdRepo.FetchAllUnits()
	if err != nil {
		return output.DBError(err)
	}
	return output.Success(units)
}
