package nekomaid

import (
	"faryne.dev/controller/helper"
	"faryne.dev/middleware/authsession"
	nekomaidEntity "faryne.dev/model/entity/nekomaid"
	serviceHelper "faryne.dev/service/helper"
	"faryne.dev/service/nekomaid"
	"faryne.dev/service/output"
	"github.com/gofiber/fiber/v3"
)

// FavoriteKeys 使用者全部收藏的 key（畫愛心、追蹤按鈕狀態用）
func FavoriteKeys(ctx fiber.Ctx) error {
	keys, err := nekomaid.FavoriteKeys(authsession.Session(ctx).UserId)
	if err != nil {
		return output.FromError(err)
	}
	return output.Success(keys)
}

// FavoriteAuthors 我的追蹤：畫師
func FavoriteAuthors(ctx fiber.Ctx) error {
	var input nekomaidEntity.FavoriteListRequest
	if err := helper.BindQuery(ctx, &input); err != nil {
		return err
	}
	rows, total, err := nekomaid.ListFavoriteAuthors(authsession.Session(ctx).UserId, input)
	if err != nil {
		return output.FromError(err)
	}
	return output.Success(serviceHelper.ResultPaginate(ctx, rows, total))
}

// FavoriteArtworks 我的追蹤：作品
func FavoriteArtworks(ctx fiber.Ctx) error {
	var input nekomaidEntity.FavoriteListRequest
	if err := helper.BindQuery(ctx, &input); err != nil {
		return err
	}
	rows, total, err := nekomaid.ListFavoriteArtworks(authsession.Session(ctx).UserId, input)
	if err != nil {
		return output.FromError(err)
	}
	return output.Success(serviceHelper.ResultPaginate(ctx, rows, total))
}

// FollowAuthor／UnfollowAuthor 追蹤、取消追蹤畫師
func FollowAuthor(ctx fiber.Ctx) error   { return setFavoriteAuthor(ctx, true) }
func UnfollowAuthor(ctx fiber.Ctx) error { return setFavoriteAuthor(ctx, false) }

// FavoriteArtwork／UnfavoriteArtwork 收藏、取消收藏作品
func FavoriteArtwork(ctx fiber.Ctx) error   { return setFavoriteArtwork(ctx, true) }
func UnfavoriteArtwork(ctx fiber.Ctx) error { return setFavoriteArtwork(ctx, false) }

func setFavoriteAuthor(ctx fiber.Ctx, on bool) error {
	err := nekomaid.SetFavoriteAuthor(authsession.Session(ctx).UserId, ctx.Params("site"), ctx.Params("authorId"), on)
	if err != nil {
		return forbiddenError(err)
	}
	return output.Success(nil)
}

func setFavoriteArtwork(ctx fiber.Ctx, on bool) error {
	err := nekomaid.SetFavoriteArtwork(authsession.Session(ctx).UserId, ctx.Params("site"), ctx.Params("authorId"), ctx.Params("artworkId"), on)
	if err != nil {
		return forbiddenError(err)
	}
	return output.Success(nil)
}

// FavoriteTags 我的追蹤：標籤
func FavoriteTags(ctx fiber.Ctx) error {
	var input nekomaidEntity.FavoriteListRequest
	if err := helper.BindQuery(ctx, &input); err != nil {
		return err
	}
	rows, total, err := nekomaid.ListFavoriteTags(authsession.Session(ctx).UserId, input)
	if err != nil {
		return output.FromError(err)
	}
	return output.Success(serviceHelper.ResultPaginate(ctx, rows, total))
}

// FollowTag 收藏標籤（標籤放在 body：可能含 /，不能放網址路徑）
func FollowTag(ctx fiber.Ctx) error {
	var input nekomaidEntity.FavoriteTagRequest
	if err := helper.BindJSON(ctx, &input); err != nil {
		return err
	}
	if err := nekomaid.SetFavoriteTag(authsession.Session(ctx).UserId, input.Tag, true); err != nil {
		return forbiddenError(err)
	}
	return output.Success(nil)
}

// UnfollowTag 取消收藏標籤（標籤放在 ?tag=）
func UnfollowTag(ctx fiber.Ctx) error {
	if err := nekomaid.SetFavoriteTag(authsession.Session(ctx).UserId, ctx.Query("tag"), false); err != nil {
		return forbiddenError(err)
	}
	return output.Success(nil)
}
