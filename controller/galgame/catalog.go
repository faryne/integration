package galgame

import (
	"errors"

	"faryne.dev/middleware/authsession"
	erogeModel "faryne.dev/model/entity/eroge"
	"faryne.dev/repository"
	"faryne.dev/service/eroge"
	"faryne.dev/service/helper"
	"faryne.dev/service/output"
	"github.com/gofiber/fiber/v3"
)

type favoriteRequest struct {
	Favorite bool `json:"favorite"`
}

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

func VideoNavigation(ctx fiber.Ctx) error {
	navigation, err := eroge.NewCatalogService().VideoNavigation(ctx.Params("brand"), ctx.Params("videoId"))
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("galgame video not found"))
		}
		return output.DBError(err)
	}
	return output.Success(navigation)
}

func BrandFavorite(ctx fiber.Ctx) error {
	session := authsession.Session(ctx)
	status, err := eroge.NewCatalogService().BrandFavorite(session.UserId, ctx.Params("brand"))
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("galgame brand not found"))
		}
		return output.DBError(err)
	}
	return output.Success(status)
}

func SetBrandFavorite(ctx fiber.Ctx) error {
	var input favoriteRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	session := authsession.Session(ctx)
	status, err := eroge.NewCatalogService().SetBrandFavorite(session.UserId, ctx.Params("brand"), input.Favorite)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("galgame brand not found"))
		}
		return output.DBError(err)
	}
	return output.Success(status)
}

func VideoFavorite(ctx fiber.Ctx) error {
	session := authsession.Session(ctx)
	status, err := eroge.NewCatalogService().VideoFavorite(session.UserId, ctx.Params("brand"), ctx.Params("videoId"))
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("galgame video not found"))
		}
		return output.DBError(err)
	}
	return output.Success(status)
}

func SetVideoFavorite(ctx fiber.Ctx) error {
	var input favoriteRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	session := authsession.Session(ctx)
	status, err := eroge.NewCatalogService().SetVideoFavorite(
		session.UserId,
		ctx.Params("brand"),
		ctx.Params("videoId"),
		input.Favorite,
	)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("galgame video not found"))
		}
		return output.DBError(err)
	}
	return output.Success(status)
}

func FavoriteStatus(ctx fiber.Ctx) error {
	var input erogeModel.FavoriteStatusRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	status, err := eroge.NewCatalogService().FavoriteStatus(authsession.Session(ctx).UserId, input)
	if err != nil {
		return output.DBError(err)
	}
	return output.Success(status)
}

func FavoriteBrands(ctx fiber.Ctx) error {
	var input erogeModel.BrandSearchRequest
	if err := ctx.Bind().Query(&input); err != nil {
		return output.BadRequest(err)
	}
	rows, total, err := eroge.NewCatalogService().FavoriteBrands(authsession.Session(ctx).UserId, input)
	if err != nil {
		return output.DBError(err)
	}
	return output.Success(helper.ResultPaginate(ctx, rows, total))
}

func FavoriteVideos(ctx fiber.Ctx) error {
	var input erogeModel.VideoSearchRequest
	if err := ctx.Bind().Query(&input); err != nil {
		return output.BadRequest(err)
	}
	rows, total, err := eroge.NewCatalogService().FavoriteVideos(authsession.Session(ctx).UserId, input)
	if err != nil {
		return output.DBError(err)
	}
	return output.Success(helper.ResultPaginate(ctx, rows, total))
}
