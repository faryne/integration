package galgame

import (
	"errors"

	erogeModel "faryne.dev/model/entity/eroge"
	"faryne.dev/repository"
	"faryne.dev/service/eroge"
	"faryne.dev/service/helper"
	"faryne.dev/service/output"
	"github.com/gofiber/fiber/v3"
)

func Brands(ctx fiber.Ctx) error {
	var input erogeModel.BrandSearchRequest
	if err := ctx.Bind().Query(&input); err != nil {
		return output.BadRequest(err)
	}
	rows, total, err := eroge.NewCatalogService().SearchBrands(input)
	if err != nil {
		return output.DBError(err)
	}
	return output.Success(helper.ResultPaginate(ctx, rows, total))
}

func Brand(ctx fiber.Ctx) error {
	brand, err := eroge.NewCatalogService().Brand(ctx.Params("brand"))
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("galgame brand not found"))
		}
		return output.DBError(err)
	}
	return output.Success(brand)
}

func Videos(ctx fiber.Ctx) error {
	var input erogeModel.VideoSearchRequest
	if err := ctx.Bind().Query(&input); err != nil {
		return output.BadRequest(err)
	}
	rows, total, err := eroge.NewCatalogService().SearchVideos(ctx.Params("brand"), input)
	if err != nil {
		return output.BadRequest(err)
	}
	return output.Success(helper.ResultPaginate(ctx, rows, total))
}

func Video(ctx fiber.Ctx) error {
	video, err := eroge.NewCatalogService().Video(ctx.Params("brand"), ctx.Params("videoId"))
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("galgame video not found"))
		}
		return output.DBError(err)
	}
	return output.Success(video)
}

func RelatedVideos(ctx fiber.Ctx) error {
	videos, err := eroge.NewCatalogService().RelatedVideos(ctx.Params("brand"), ctx.Params("videoId"))
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("galgame video not found"))
		}
		return output.DBError(err)
	}
	return output.Success(videos)
}
