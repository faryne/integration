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

func AuthorProfiles(ctx fiber.Ctx) error {
	rows, err := storyteller.NewService().AuthorProfiles(authsession.Session(ctx).UserId)
	if err != nil {
		return output.DBError(err)
	}
	return output.Success(rows)
}

func CreateAuthorProfile(ctx fiber.Ctx) error {
	var input storytellerModel.AuthorProfileRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	row, err := storyteller.NewService().CreateAuthorProfile(authsession.Session(ctx).UserId, input)
	if err != nil {
		return output.BadRequest(err)
	}
	return output.Success(row)
}

func UpdateAuthorProfile(ctx fiber.Ctx) error {
	profileID, err := parseUint(ctx.Params("profile"))
	if err != nil {
		return output.BadRequest(err)
	}
	var input storytellerModel.AuthorProfileRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	row, err := storyteller.NewService().UpdateAuthorProfile(authsession.Session(ctx).UserId, profileID, input)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("profile not found"))
		}
		return output.BadRequest(err)
	}
	return output.Success(row)
}

func DeleteAuthorProfile(ctx fiber.Ctx) error {
	profileID, err := parseUint(ctx.Params("profile"))
	if err != nil {
		return output.BadRequest(err)
	}
	if err := storyteller.NewService().DeleteAuthorProfile(authsession.Session(ctx).UserId, profileID); err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("profile not found"))
		}
		return output.BadRequest(err)
	}
	return output.Success(map[string]bool{"deleted": true})
}
