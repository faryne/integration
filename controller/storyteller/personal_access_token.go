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

func PersonalAccessTokens(ctx fiber.Ctx) error {
	rows, err := storyteller.NewService().PersonalAccessTokens(authsession.Session(ctx).UserId)
	if err != nil {
		return output.DBError(err)
	}
	return output.Success(rows)
}

func CreatePersonalAccessToken(ctx fiber.Ctx) error {
	var input storytellerModel.PersonalAccessTokenRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	row, err := storyteller.NewService().CreatePersonalAccessToken(authsession.Session(ctx).UserId, input)
	if err != nil {
		return output.BadRequest(err)
	}
	return output.Success(row)
}

func DeletePersonalAccessToken(ctx fiber.Ctx) error {
	id, err := parseUint(ctx.Params("token"))
	if err != nil {
		return output.BadRequest(err)
	}
	if err := storyteller.NewService().DeletePersonalAccessToken(authsession.Session(ctx).UserId, id); err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("personal access token not found"))
		}
		return output.BadRequest(err)
	}
	return output.Success(map[string]bool{"deleted": true})
}
