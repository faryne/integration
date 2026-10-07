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

// readingRecordsRequest 是批次回報閱讀進度的 body；平常一次一筆，登入後補寫 localStorage 時一次多筆。
type readingRecordsRequest struct {
	Records []storytellerModel.ReadingRecordInput `json:"records"`
}

// ReadingRecords 回傳登入讀者在這個專案的閱讀進度。
func ReadingRecords(ctx fiber.Ctx) error {
	rows, err := storyteller.NewService().ReadingRecords(authsession.Session(ctx).UserId, ctx.Params("project"))
	return readingRecordsResponse(rows, err)
}

// SaveReadingRecords 寫入閱讀進度（只增不減），回傳寫入後的完整列表。
func SaveReadingRecords(ctx fiber.Ctx) error {
	var input readingRecordsRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	rows, err := storyteller.NewService().SaveReadingRecords(authsession.Session(ctx).UserId, ctx.Params("project"), input.Records)
	return readingRecordsResponse(rows, err)
}

func readingRecordsResponse(rows []storytellerModel.ReadingRecordOutput, err error) error {
	switch {
	case err == nil:
		return output.Success(rows)
	case repository.IsRecordNotFound(err):
		return output.NotFound(errors.New("storyteller project not found"))
	default:
		return output.BadRequest(err)
	}
}
