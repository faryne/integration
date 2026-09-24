package storyteller

import (
	"errors"

	"faryne.dev/middleware/authsession"
	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/repository"
	"faryne.dev/service/output"
	storytellerService "faryne.dev/service/storyteller"
	"github.com/gofiber/fiber/v3"
)

func WorkspaceSearch(ctx fiber.Ctx) error {
	rows, err := storytellerService.NewService().SearchWorkspace(
		authsession.Session(ctx).UserId,
		ctx.Params("project"),
		ctx.Query("keyword"),
		storytellerModel.WorkspaceSearchKind(ctx.Query("kind")),
	)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return output.NotFound(errors.New("storyteller project not found"))
		}
		if errors.Is(err, storytellerService.ErrWorkspaceSearchKeywordTooLong) || errors.Is(err, storytellerService.ErrWorkspaceSearchKindInvalid) {
			return output.BadRequest(err)
		}
		return output.DBError(err)
	}
	return output.Success(rows)
}
