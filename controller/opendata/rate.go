package opendata

import (
	rates3 "faryne.dev/model/entity/opendata/rates"
	rates2 "faryne.dev/repository/rates"
	"faryne.dev/service/output"
	"github.com/gofiber/fiber/v3"
)

func Rate(ctx fiber.Ctx) error {
	var req rates3.RateRequest
	if err := ctx.Bind().Query(&req); err != nil {
		return output.BadRequest(err)
	}
	rates, err := rates2.FetchRates(req)
	if err != nil {
		return output.DBError(err)
	}
	return output.Success(rates)
}

func Banks(ctx fiber.Ctx) error {
	banks, err := rates2.GetBanks()
	if err != nil {
		return output.DBError(err)
	}
	return output.Success(banks)
}

func Currencies(ctx fiber.Ctx) error {
	return nil
}
