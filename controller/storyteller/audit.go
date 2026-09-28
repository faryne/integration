package storyteller

import (
	"errors"
	"strconv"

	"faryne.dev/middleware/authsession"
	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/repository"
	"faryne.dev/service/output"
	storytellerService "faryne.dev/service/storyteller"
	"github.com/gofiber/fiber/v3"
)

// AccountAuditEvents 查登入者本人的活動紀錄（近期、MySQL）。
func AccountAuditEvents(ctx fiber.Ctx) error {
	page, err := storytellerService.NewService().AccountAuditEvents(authsession.Session(ctx).UserId, auditEventListParams(ctx))
	return auditQueryResponse(page, err)
}

func AccountAuditEventFilters(ctx fiber.Ctx) error {
	filters, err := storytellerService.NewService().AccountAuditEventFilters(authsession.Session(ctx).UserId)
	return auditQueryResponse(filters, err)
}

func auditEventListParams(ctx fiber.Ctx) storytellerModel.AuditEventListParams {
	limit, _ := strconv.Atoi(ctx.Query("limit"))
	includeLow, _ := strconv.ParseBool(ctx.Query("include_low_importance"))
	return storytellerModel.AuditEventListParams{
		Cursor: ctx.Query("cursor"), Limit: limit, ProjectPublicID: ctx.Query("project_public_id"), Category: ctx.Query("category"),
		Source: ctx.Query("source"), Outcome: ctx.Query("outcome"), CredentialRef: ctx.Query("credential_ref"),
		From: ctx.Query("from"), To: ctx.Query("to"), IncludeLowImportance: includeLow,
	}
}

func auditQueryResponse(data any, err error) error {
	switch {
	case err == nil:
		return output.Success(data)
	case repository.IsRecordNotFound(err):
		return output.NotFound(errors.New("找不到要查詢的活動紀錄"))
	case errors.Is(err, storytellerService.ErrAuditArchiveRequired),
		errors.Is(err, storytellerService.ErrAuditFilterInvalid),
		errors.Is(err, storytellerService.ErrAuditCursorInvalid):
		return output.BadRequest(err)
	default:
		return output.DBError(err)
	}
}
