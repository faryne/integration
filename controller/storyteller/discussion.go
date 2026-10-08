package storyteller

import (
	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/service/output"
	"faryne.dev/service/storyteller"
	"github.com/gofiber/fiber/v3"
)

// 專案討論版。讀取公開（帶登入 header 時多回能否發言、可用身份、權限）；不公開作品一律帶 ?share=分享 token。
// 錯誤轉換沿用 authorPostError（被封鎖、沒筆名、太頻繁、已鎖定等）。

func PublicDiscussionThreads(ctx fiber.Ctx) error {
	var query storytellerModel.DiscussionListQuery
	if err := ctx.Bind().Query(&query); err != nil {
		return output.BadRequest(err)
	}
	return authorPostResponse(storyteller.NewService().ListDiscussionThreads(optionalViewerID(ctx), ctx.Params("project"), query))
}

func PublicDiscussionThread(ctx fiber.Ctx) error {
	return authorPostResponse(storyteller.NewService().DiscussionThreadDetail(optionalViewerID(ctx), ctx.Params("thread"), ctx.Query("share")))
}

func CreateDiscussionThread(ctx fiber.Ctx) error {
	var input storytellerModel.DiscussionThreadRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	return authorPostResponse(storyteller.NewService().CreateDiscussionThread(sessionUserID(ctx), ctx.Params("project"), ctx.Query("share"), input))
}

func EditDiscussionThread(ctx fiber.Ctx) error {
	var input storytellerModel.DiscussionThreadEditRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	return authorPostResponse(nil, storyteller.NewService().EditDiscussionThread(sessionUserID(ctx), ctx.Params("thread"), input))
}

func DeleteDiscussionThread(ctx fiber.Ctx) error {
	return authorPostResponse(nil, storyteller.NewService().DeleteDiscussionThread(sessionUserID(ctx), ctx.Params("thread")))
}

func LockDiscussionThread(ctx fiber.Ctx) error {
	return authorPostResponse(nil, storyteller.NewService().SetDiscussionThreadLocked(sessionUserID(ctx), ctx.Params("thread"), true))
}

func UnlockDiscussionThread(ctx fiber.Ctx) error {
	return authorPostResponse(nil, storyteller.NewService().SetDiscussionThreadLocked(sessionUserID(ctx), ctx.Params("thread"), false))
}

func BlockDiscussionStarter(ctx fiber.Ctx) error {
	return authorPostResponse(nil, storyteller.NewService().BlockDiscussionStarter(sessionUserID(ctx), ctx.Params("thread")))
}

func CreateDiscussionComment(ctx fiber.Ctx) error {
	var input storytellerModel.CommentRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	return authorPostResponse(storyteller.NewService().CreateDiscussionComment(sessionUserID(ctx), ctx.Params("thread"), ctx.Query("share"), input))
}

func EditComment(ctx fiber.Ctx) error {
	var input storytellerModel.CommentEditRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	return authorPostResponse(nil, storyteller.NewService().EditComment(sessionUserID(ctx), ctx.Params("comment"), input))
}
