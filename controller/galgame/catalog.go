package galgame

import (
	"context"
	"errors"
	"strconv"
	"time"

	"github.com/gofiber/fiber/v3"

	"faryne.dev/controller/helper"
	"faryne.dev/middleware/authsession"
	erogeModel "faryne.dev/model/entity/eroge"
	"faryne.dev/repository"
	"faryne.dev/service/eroge"
	serviceHelper "faryne.dev/service/helper"
	"faryne.dev/service/output"
)

type favoriteRequest struct {
	Favorite bool `json:"favorite"`
}

func Brands(ctx fiber.Ctx) error {
	var input erogeModel.BrandSearchRequest
	if err := helper.BindQuery(ctx, &input); err != nil {
		return err
	}
	rows, total, err := eroge.NewCatalogService().SearchBrands(input)
	if err != nil {
		return output.DBError(err)
	}
	return output.Success(serviceHelper.ResultPaginate(ctx, rows, total))
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

func SubmitBrands(ctx fiber.Ctx) error {
	var input erogeModel.BrandSubmissionRequest
	if err := helper.BindJSON(ctx, &input); err != nil {
		return err
	}
	if len(input.Channels) == 0 {
		return output.BadRequest(errors.New("channels is required"))
	}
	requestCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	service, err := eroge.NewService(requestCtx)
	if err != nil {
		return output.DBError(err)
	}
	var userID uint64
	if session := authsession.Session(ctx); session != nil {
		userID = session.UserId
	}
	results, err := service.SubmitBrands(requestCtx, userID, input.Channels)
	if err != nil {
		return output.DBError(err)
	}
	return output.Success(results)
}

func AdminBrands(ctx fiber.Ctx) error {
	var input erogeModel.BrandSearchRequest
	if err := helper.BindQuery(ctx, &input); err != nil {
		return err
	}
	rows, total, err := eroge.NewCatalogService().AdminSearchBrands(authsession.Session(ctx).UserId, input)
	if err != nil {
		return output.Unauthorized(err)
	}
	return output.Success(serviceHelper.ResultPaginate(ctx, rows, total))
}

func SetBrandStatus(ctx fiber.Ctx) error {
	brandID, err := strconv.ParseUint(ctx.Params("brandId"), 10, 64)
	if err != nil || brandID == 0 {
		return output.BadRequest(errors.New("invalid brand ID"))
	}
	var input erogeModel.BrandStatusRequest
	if err := helper.BindJSON(ctx, &input); err != nil {
		return err
	}
	requestCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	brand, err := eroge.NewCatalogService().SetBrandStatus(requestCtx, authsession.Session(ctx).UserId, brandID, input.Status)
	if err != nil {
		return output.BadRequest(err)
	}
	return output.Success(brand)
}

func DeleteBrand(ctx fiber.Ctx) error {
	brandID, err := strconv.ParseUint(ctx.Params("brandId"), 10, 64)
	if err != nil || brandID == 0 {
		return output.BadRequest(errors.New("invalid brand ID"))
	}
	if err := eroge.NewCatalogService().DeleteBrand(authsession.Session(ctx).UserId, brandID); err != nil {
		return output.BadRequest(err)
	}
	return output.Success(map[string]string{"status": "queued"})
}

func RestoreBrand(ctx fiber.Ctx) error {
	brandID, err := strconv.ParseUint(ctx.Params("brandId"), 10, 64)
	if err != nil || brandID == 0 {
		return output.BadRequest(errors.New("invalid brand ID"))
	}
	if err := eroge.NewCatalogService().RestoreBrand(authsession.Session(ctx).UserId, brandID); err != nil {
		return output.BadRequest(err)
	}
	return output.Success(map[string]string{"status": "queued"})
}

func PauseBrandIndexing(ctx fiber.Ctx) error {
	brandID, err := strconv.ParseUint(ctx.Params("brandId"), 10, 64)
	if err != nil || brandID == 0 {
		return output.BadRequest(errors.New("invalid brand ID"))
	}
	if err := eroge.NewCatalogService().PauseBrandIndexing(authsession.Session(ctx).UserId, brandID); err != nil {
		return output.BadRequest(err)
	}
	return output.Success(map[string]string{"status": "ok"})
}

func ResumeBrandIndexing(ctx fiber.Ctx) error {
	brandID, err := strconv.ParseUint(ctx.Params("brandId"), 10, 64)
	if err != nil || brandID == 0 {
		return output.BadRequest(errors.New("invalid brand ID"))
	}
	if err := eroge.NewCatalogService().ResumeBrandIndexing(authsession.Session(ctx).UserId, brandID); err != nil {
		return output.BadRequest(err)
	}
	return output.Success(map[string]string{"status": "queued"})
}

func SyncBrandVideosNow(ctx fiber.Ctx) error {
	brandID, err := strconv.ParseUint(ctx.Params("brandId"), 10, 64)
	if err != nil || brandID == 0 {
		return output.BadRequest(errors.New("invalid brand ID"))
	}
	if err := eroge.NewCatalogService().SyncBrandVideosNow(authsession.Session(ctx).UserId, brandID); err != nil {
		return output.BadRequest(err)
	}
	return output.Success(map[string]string{"status": "queued"})
}

func AdminVideos(ctx fiber.Ctx) error {
	var input erogeModel.VideoSearchRequest
	if err := helper.BindQuery(ctx, &input); err != nil {
		return err
	}
	rows, total, err := eroge.NewCatalogService().AdminSearchVideos(authsession.Session(ctx).UserId, input)
	if err != nil {
		return output.Unauthorized(err)
	}
	return output.Success(serviceHelper.ResultPaginate(ctx, rows, total))
}

func DeleteVideo(ctx fiber.Ctx) error {
	videoID, err := strconv.ParseUint(ctx.Params("videoId"), 10, 64)
	if err != nil || videoID == 0 {
		return output.BadRequest(errors.New("invalid video ID"))
	}
	if err := eroge.NewCatalogService().DeleteVideo(authsession.Session(ctx).UserId, videoID); err != nil {
		return output.BadRequest(err)
	}
	return output.Success(map[string]string{"status": "queued"})
}

func RestoreVideo(ctx fiber.Ctx) error {
	videoID, err := strconv.ParseUint(ctx.Params("videoId"), 10, 64)
	if err != nil || videoID == 0 {
		return output.BadRequest(errors.New("invalid video ID"))
	}
	if err := eroge.NewCatalogService().RestoreVideo(authsession.Session(ctx).UserId, videoID); err != nil {
		return output.BadRequest(err)
	}
	return output.Success(map[string]string{"status": "queued"})
}

func SubmitVideos(ctx fiber.Ctx) error {
	var input erogeModel.VideoSubmissionRequest
	if err := helper.BindJSON(ctx, &input); err != nil {
		return err
	}
	if len(input.URLs) == 0 {
		return output.BadRequest(errors.New("urls is required"))
	}
	requestCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	service, err := eroge.NewService(requestCtx)
	if err != nil {
		return output.DBError(err)
	}
	var userID uint64
	if session := authsession.Session(ctx); session != nil {
		userID = session.UserId
	}
	results, err := service.SubmitVideos(requestCtx, userID, input.URLs)
	if err != nil {
		return output.DBError(err)
	}
	return output.Success(results)
}

func AdminVideoSubmissions(ctx fiber.Ctx) error {
	var input erogeModel.VideoSubmissionSearchRequest
	if err := helper.BindQuery(ctx, &input); err != nil {
		return err
	}
	rows, total, err := eroge.NewCatalogService().AdminSearchVideoSubmissions(authsession.Session(ctx).UserId, input)
	if err != nil {
		return output.Unauthorized(err)
	}
	return output.Success(serviceHelper.ResultPaginate(ctx, rows, total))
}

func SetVideoSubmissionStatus(ctx fiber.Ctx) error {
	submissionID, err := strconv.ParseUint(ctx.Params("submissionId"), 10, 64)
	if err != nil || submissionID == 0 {
		return output.BadRequest(errors.New("invalid submission ID"))
	}
	var input erogeModel.VideoSubmissionStatusRequest
	if err := helper.BindJSON(ctx, &input); err != nil {
		return err
	}
	requestCtx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()
	service, err := eroge.NewService(requestCtx)
	if err != nil {
		return output.DBError(err)
	}
	if err := service.SetVideoSubmissionStatus(requestCtx, authsession.Session(ctx).UserId, submissionID, input.Status); err != nil {
		return output.BadRequest(err)
	}
	return output.Success(map[string]string{"status": input.Status})
}

func AdminVideoTitleKeywords(ctx fiber.Ctx) error {
	var input erogeModel.VideoTitleKeywordSearchRequest
	if err := helper.BindQuery(ctx, &input); err != nil {
		return err
	}
	rows, total, err := eroge.NewCatalogService().AdminSearchVideoTitleKeywords(authsession.Session(ctx).UserId, input)
	if err != nil {
		return output.Unauthorized(err)
	}
	return output.Success(serviceHelper.ResultPaginate(ctx, rows, total))
}

func CreateVideoTitleKeyword(ctx fiber.Ctx) error {
	var input erogeModel.VideoTitleKeywordRequest
	if err := helper.BindJSON(ctx, &input); err != nil {
		return err
	}
	row, err := eroge.NewCatalogService().CreateVideoTitleKeyword(authsession.Session(ctx).UserId, input)
	if err != nil {
		return output.BadRequest(err)
	}
	return output.Success(row)
}

func UpdateVideoTitleKeyword(ctx fiber.Ctx) error {
	keywordID, err := strconv.ParseUint(ctx.Params("keywordId"), 10, 64)
	if err != nil || keywordID == 0 {
		return output.BadRequest(errors.New("invalid keyword ID"))
	}
	var input erogeModel.VideoTitleKeywordRequest
	if err := helper.BindJSON(ctx, &input); err != nil {
		return err
	}
	row, err := eroge.NewCatalogService().UpdateVideoTitleKeyword(authsession.Session(ctx).UserId, keywordID, input)
	if err != nil {
		return output.BadRequest(err)
	}
	return output.Success(row)
}

func DeleteVideoTitleKeyword(ctx fiber.Ctx) error {
	keywordID, err := strconv.ParseUint(ctx.Params("keywordId"), 10, 64)
	if err != nil || keywordID == 0 {
		return output.BadRequest(errors.New("invalid keyword ID"))
	}
	if err := eroge.NewCatalogService().DeleteVideoTitleKeyword(authsession.Session(ctx).UserId, keywordID); err != nil {
		return output.BadRequest(err)
	}
	return output.Success(map[string]string{"status": "ok"})
}

func Videos(ctx fiber.Ctx) error {
	var input erogeModel.VideoSearchRequest
	if err := helper.BindQuery(ctx, &input); err != nil {
		return err
	}
	rows, total, err := eroge.NewCatalogService().SearchVideos(ctx.Params("brand"), input)
	if err != nil {
		return output.BadRequest(err)
	}
	return output.Success(serviceHelper.ResultPaginate(ctx, rows, total))
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
	if err := helper.BindJSON(ctx, &input); err != nil {
		return err
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
	if err := helper.BindJSON(ctx, &input); err != nil {
		return err
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

func VideoReaction(ctx fiber.Ctx) error {
	session := authsession.Session(ctx)
	status, err := eroge.NewCatalogService().VideoReaction(session.UserId, ctx.Params("brand"), ctx.Params("videoId"))
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("galgame video not found"))
		}
		return output.DBError(err)
	}
	return output.Success(status)
}

func SetVideoReaction(ctx fiber.Ctx) error {
	var input erogeModel.VideoReactionRequest
	if err := helper.BindJSON(ctx, &input); err != nil {
		return err
	}
	session := authsession.Session(ctx)
	status, err := eroge.NewCatalogService().SetVideoReaction(
		session.UserId,
		ctx.Params("brand"),
		ctx.Params("videoId"),
		input.Action,
	)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("galgame video not found"))
		}
		return output.BadRequest(err)
	}
	return output.Success(status)
}

func FavoriteStatus(ctx fiber.Ctx) error {
	var input erogeModel.FavoriteStatusRequest
	if err := helper.BindJSON(ctx, &input); err != nil {
		return err
	}
	status, err := eroge.NewCatalogService().FavoriteStatus(authsession.Session(ctx).UserId, input)
	if err != nil {
		return output.DBError(err)
	}
	return output.Success(status)
}

func FavoriteBrands(ctx fiber.Ctx) error {
	var input erogeModel.BrandSearchRequest
	if err := helper.BindQuery(ctx, &input); err != nil {
		return err
	}
	rows, total, err := eroge.NewCatalogService().FavoriteBrands(authsession.Session(ctx).UserId, input)
	if err != nil {
		return output.DBError(err)
	}
	return output.Success(serviceHelper.ResultPaginate(ctx, rows, total))
}

func FavoriteVideos(ctx fiber.Ctx) error {
	var input erogeModel.VideoSearchRequest
	if err := helper.BindQuery(ctx, &input); err != nil {
		return err
	}
	rows, total, err := eroge.NewCatalogService().FavoriteVideos(authsession.Session(ctx).UserId, input)
	if err != nil {
		return output.DBError(err)
	}
	return output.Success(serviceHelper.ResultPaginate(ctx, rows, total))
}
