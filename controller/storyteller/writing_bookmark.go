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

func writingBookmarkLookupError(err error, notFound error) error {
	if repository.IsRecordNotFound(err) {
		return output.NotFound(notFound)
	}
	if errors.Is(err, storyteller.ErrWritingBookmarkNotFound) {
		return output.NotFound(err)
	}
	if errors.Is(err, storyteller.ErrWritingBookmarkDuplicate) {
		return output.BadRequest(err)
	}
	return output.BadRequest(err)
}

func StoryWritingBookmarks(ctx fiber.Ctx) error {
	rows, err := storyteller.NewService().StoryWritingBookmarks(
		authsession.Session(ctx).UserId,
		ctx.Params("project"),
		ctx.Params("story"),
	)
	if err != nil {
		return writingBookmarkLookupError(err, errors.New("storyteller story not found"))
	}
	return output.Success(rows)
}

func CreateStoryWritingBookmark(ctx fiber.Ctx) error {
	var input storytellerModel.WritingBookmarkRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	row, err := storyteller.NewService().CreateStoryWritingBookmark(
		authsession.Session(ctx).UserId,
		ctx.Params("project"),
		ctx.Params("story"),
		input,
	)
	if err != nil {
		return writingBookmarkLookupError(err, errors.New("storyteller story not found"))
	}
	return output.Success(row)
}

func UpdateStoryWritingBookmark(ctx fiber.Ctx) error {
	var input storytellerModel.WritingBookmarkRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	row, err := storyteller.NewService().UpdateStoryWritingBookmark(
		authsession.Session(ctx).UserId,
		ctx.Params("project"),
		ctx.Params("story"),
		input,
	)
	if err != nil {
		return writingBookmarkLookupError(err, errors.New("storyteller story not found"))
	}
	return output.Success(row)
}

func DeleteStoryWritingBookmark(ctx fiber.Ctx) error {
	var input storytellerModel.WritingBookmarkRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	if err := storyteller.NewService().DeleteStoryWritingBookmark(
		authsession.Session(ctx).UserId,
		ctx.Params("project"),
		ctx.Params("story"),
		input.MarkerID,
	); err != nil {
		return writingBookmarkLookupError(err, errors.New("storyteller story not found"))
	}
	return output.Success(map[string]bool{"deleted": true})
}

func LoreWritingBookmarks(ctx fiber.Ctx) error {
	rows, err := storyteller.NewService().LoreWritingBookmarks(
		authsession.Session(ctx).UserId,
		ctx.Params("project"),
		ctx.Params("lore"),
	)
	if err != nil {
		return writingBookmarkLookupError(err, errors.New("storyteller lore not found"))
	}
	return output.Success(rows)
}

func CreateLoreWritingBookmark(ctx fiber.Ctx) error {
	var input storytellerModel.WritingBookmarkRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	row, err := storyteller.NewService().CreateLoreWritingBookmark(
		authsession.Session(ctx).UserId,
		ctx.Params("project"),
		ctx.Params("lore"),
		input,
	)
	if err != nil {
		return writingBookmarkLookupError(err, errors.New("storyteller lore not found"))
	}
	return output.Success(row)
}

func UpdateLoreWritingBookmark(ctx fiber.Ctx) error {
	var input storytellerModel.WritingBookmarkRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	row, err := storyteller.NewService().UpdateLoreWritingBookmark(
		authsession.Session(ctx).UserId,
		ctx.Params("project"),
		ctx.Params("lore"),
		input,
	)
	if err != nil {
		return writingBookmarkLookupError(err, errors.New("storyteller lore not found"))
	}
	return output.Success(row)
}

func DeleteLoreWritingBookmark(ctx fiber.Ctx) error {
	var input storytellerModel.WritingBookmarkRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	if err := storyteller.NewService().DeleteLoreWritingBookmark(
		authsession.Session(ctx).UserId,
		ctx.Params("project"),
		ctx.Params("lore"),
		input.MarkerID,
	); err != nil {
		return writingBookmarkLookupError(err, errors.New("storyteller lore not found"))
	}
	return output.Success(map[string]bool{"deleted": true})
}
