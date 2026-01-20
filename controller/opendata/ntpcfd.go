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

func FDRealtime(ctx fiber.Ctx) error {
	eventsNewTaipei, err := fdService.NewTaipei()
	if err != nil {
		return output.ExternalServiceError(err)
	}
	eventsTaipei, err := fdService.Taipei()
	if err != nil {
		return output.ExternalServiceError(err)
	}
	return output.Success(map[string][]fdService.Event{
		"taipei":     eventsTaipei,
		"new_taipei": eventsNewTaipei,
	})
}

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

func FetchNtpcFDUnits(ctx fiber.Ctx) error {
	units, err := ntpcfdRepo.FetchAllUnits()
	if err != nil {
		return output.DBError(err)
	}
	return output.Success(units)
}
