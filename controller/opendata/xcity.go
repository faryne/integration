package opendata

import (
	"faryne.dev/model/entity/opendata/av"
	"faryne.dev/service/output"
	"faryne.dev/service/xcity"
	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v3"
)

func XCityActressList(ctx fiber.Ctx) error {
	var req av.ActressQuery
	if err := ctx.Bind().Query(&req); err != nil {
		return output.BadRequest(err)
	}
	if err := validator.New().Struct(&req); err != nil {
		return output.BadRequest(err)
	}

	rows, err := xcity.ActressList(req.Syllabus, req.Page)
	if err != nil {
		return output.DBError(err)
	}
	return output.Success(rows)
}

func XCityActressDetail(ctx fiber.Ctx) error {
	id := ctx.Params("id")
	actress, _ := xcity.GetActressDetail(id)
	return output.Success(actress)
}
