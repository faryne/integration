package storyteller

import (
	"errors"
	"strconv"

	"faryne.dev/middleware/authsession"
	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/repository"
	"faryne.dev/service/output"
	"faryne.dev/service/storyteller"
	"github.com/gofiber/fiber/v3"
)

func Assets(ctx fiber.Ctx) error {
	page, _ := strconv.Atoi(ctx.Query("page", "1"))
	pageSize, _ := strconv.Atoi(ctx.Query("page_size", "24"))
	rows, err := storyteller.NewService().Assets(
		authsession.Session(ctx).UserId,
		ctx.Params("project"),
		ctx.Query("asset_type"),
		ctx.Query("keyword"),
		page,
		pageSize,
	)
	if err != nil {
		return output.BadRequest(err)
	}
	return output.Success(rows)
}

func Asset(ctx fiber.Ctx) error {
	row, err := storyteller.NewService().Asset(authsession.Session(ctx).UserId, ctx.Params("project"), ctx.Params("asset"))
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("storyteller asset not found"))
		}
		return output.BadRequest(err)
	}
	return output.Success(row)
}

func PresignAssetUpload(ctx fiber.Ctx) error {
	var input storytellerModel.AssetUploadRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	rows, err := storyteller.NewService().PresignAssetUpload(ctx.Context(), authsession.Session(ctx).UserId, ctx.Params("project"), input)
	if err != nil {
		return output.BadRequest(err)
	}
	return output.Success(rows)
}

func ConfirmAssetUpload(ctx fiber.Ctx) error {
	var input storytellerModel.AssetConfirmRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	row, err := storyteller.NewService().ConfirmAssetUpload(authsession.Session(ctx).UserId, ctx.Params("project"), input)
	if err != nil {
		return output.BadRequest(err)
	}
	return output.Success(row)
}

func UpdateAsset(ctx fiber.Ctx) error {
	var input storytellerModel.AssetUpdateRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	row, err := storyteller.NewService().UpdateAsset(authsession.Session(ctx).UserId, ctx.Params("project"), ctx.Params("asset"), input)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("storyteller asset not found"))
		}
		return output.BadRequest(err)
	}
	return output.Success(row)
}

func DeleteAsset(ctx fiber.Ctx) error {
	if err := storyteller.NewService().DeleteAsset(authsession.Session(ctx).UserId, ctx.Params("project"), ctx.Params("asset")); err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("storyteller asset not found"))
		}
		return output.BadRequest(err)
	}
	return output.Success(map[string]bool{"deleted": true})
}
