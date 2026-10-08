package storyteller

import (
	"errors"

	"faryne.dev/middleware/authsession"
	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/repository"
	"faryne.dev/service/output"
	"faryne.dev/service/storyteller"
	"github.com/gofiber/fiber/v3"
)

// 作者動態、留言、封鎖。讀取類 API 公開（帶登入 header 時多回按讚／能否留言等狀態），寫入類需登入。

const (
	customCodeAuthorPostForbidden    output.CustomCode = "403001"
	customCodeCommentBlocked         output.CustomCode = "403002"
	customCodeCommentPenNameRequired output.CustomCode = "409004"
	customCodeSocialWriteRateLimited output.CustomCode = "429001"
)

// authorPostError 統一錯誤轉換：輸入錯誤 400、權限 403、被封鎖 403、沒筆名 409、太頻繁 429。
func authorPostError(err error) error {
	var validation storyteller.PostValidationError
	switch {
	case repository.IsRecordNotFound(err):
		return output.NotFound(errors.New("找不到這則動態或留言"))
	case errors.As(err, &validation):
		return output.BadRequest(validation)
	case errors.Is(err, storyteller.ErrAuthorPostForbidden):
		return output.New(fiber.StatusForbidden, customCodeAuthorPostForbidden, nil, "沒有權限操作這則動態")
	case errors.Is(err, storyteller.ErrCommentBlocked):
		return output.New(fiber.StatusForbidden, customCodeCommentBlocked, nil, "作者已限制你在這裡留言")
	case errors.Is(err, storyteller.ErrCommentPenNameRequired):
		return output.New(fiber.StatusConflict, customCodeCommentPenNameRequired, nil, "留言前請先設定筆名")
	case errors.Is(err, storyteller.ErrSocialRateLimited):
		return output.New(fiber.StatusTooManyRequests, customCodeSocialWriteRateLimited, nil, "動作太頻繁了，請稍後再試")
	default:
		return output.DBError(err)
	}
}

// authorPostResponse 是「成功回 data、失敗走 authorPostError」的共用收尾。
func authorPostResponse(data any, err error) error {
	if err != nil {
		return authorPostError(err)
	}
	return output.Success(data)
}

func sessionUserID(ctx fiber.Ctx) uint64 { return authsession.Session(ctx).UserId }

func PublicAuthorPosts(ctx fiber.Ctx) error {
	return authorPostResponse(storyteller.NewService().ListAuthorPosts(ctx.Params("username"), ctx.Query("cursor"), optionalViewerID(ctx)))
}

func PublicAuthorPost(ctx fiber.Ctx) error {
	return authorPostResponse(storyteller.NewService().AuthorPostDetail(ctx.Params("post"), optionalViewerID(ctx)))
}

func CreateAuthorPost(ctx fiber.Ctx) error {
	var input storytellerModel.AuthorPostRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	return authorPostResponse(storyteller.NewService().CreateAuthorPost(sessionUserID(ctx), ctx.Params("username"), input))
}

func AttachableWorks(ctx fiber.Ctx) error {
	return authorPostResponse(storyteller.NewService().AttachableWorks(sessionUserID(ctx), ctx.Params("username")))
}

func DeleteAuthorPost(ctx fiber.Ctx) error {
	return authorPostResponse(nil, storyteller.NewService().DeleteAuthorPost(sessionUserID(ctx), ctx.Params("post")))
}

func PinAuthorPost(ctx fiber.Ctx) error {
	return authorPostResponse(nil, storyteller.NewService().SetAuthorPostPinned(sessionUserID(ctx), ctx.Params("post"), true))
}

func UnpinAuthorPost(ctx fiber.Ctx) error {
	return authorPostResponse(nil, storyteller.NewService().SetAuthorPostPinned(sessionUserID(ctx), ctx.Params("post"), false))
}

func LikeAuthorPost(ctx fiber.Ctx) error {
	return authorPostResponse(nil, storyteller.NewService().SetAuthorPostLiked(sessionUserID(ctx), ctx.Params("post"), true))
}

func UnlikeAuthorPost(ctx fiber.Ctx) error {
	return authorPostResponse(nil, storyteller.NewService().SetAuthorPostLiked(sessionUserID(ctx), ctx.Params("post"), false))
}

func CreateComment(ctx fiber.Ctx) error {
	var input storytellerModel.CommentRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	return authorPostResponse(storyteller.NewService().CreateComment(sessionUserID(ctx), ctx.Params("post"), input))
}

func DeleteComment(ctx fiber.Ctx) error {
	return authorPostResponse(nil, storyteller.NewService().DeleteComment(sessionUserID(ctx), ctx.Params("comment")))
}

func BlockCommenter(ctx fiber.Ctx) error {
	return authorPostResponse(nil, storyteller.NewService().BlockCommenter(sessionUserID(ctx), ctx.Params("comment")))
}

func AuthorBlocks(ctx fiber.Ctx) error {
	return authorPostResponse(storyteller.NewService().AuthorBlocks(sessionUserID(ctx), ctx.Query("as")))
}

func DeleteAuthorBlock(ctx fiber.Ctx) error {
	return authorPostResponse(nil, storyteller.NewService().DeleteAuthorBlock(sessionUserID(ctx), ctx.Params("block")))
}
