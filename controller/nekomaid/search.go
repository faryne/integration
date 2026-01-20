package nekomaid

import (
	nekomaidService "faryne.dev/service/nekomaid"
	"faryne.dev/service/output"
	"github.com/gofiber/fiber/v3"
)

func Search(ctx fiber.Ctx) error {
	raw, _, err := nekomaidService.Search(ctx)
	if err != nil {
		return output.ESError(err)
	}
	return output.Success(raw.Aggregations)
}
