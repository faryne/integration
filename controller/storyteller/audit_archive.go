package storyteller

import (
	"errors"

	"faryne.dev/middleware/authsession"
	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/repository"
	"faryne.dev/service/log"
	"faryne.dev/service/output"
	storytellerService "faryne.dev/service/storyteller"
	"github.com/gofiber/fiber/v3"
	"go.uber.org/zap"
)

// ProjectAuditArchiveMonths 列出專案可查詢與已刪除的封存月份，並告訴前端封存查詢是否開放。
func ProjectAuditArchiveMonths(ctx fiber.Ctx) error {
	months, err := storytellerService.NewService().ProjectAuditArchiveMonths(authsession.Session(ctx).UserId, ctx.Params("project"))
	return auditArchiveResponse(months, err)
}

// CreateProjectAuditArchiveQuery 建立封存查詢 job；實際查詢在 Athena 背景執行，前端再輪詢狀態。
func CreateProjectAuditArchiveQuery(ctx fiber.Ctx) error {
	var input storytellerModel.AuditArchiveQueryRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	job, err := storytellerService.NewService().CreateProjectAuditArchiveQuery(ctx.Context(), authsession.Session(ctx).UserId, ctx.Params("project"), input)
	return auditArchiveResponse(job, err)
}

func AuditArchiveQueryStatus(ctx fiber.Ctx) error {
	job, err := storytellerService.NewService().AuditArchiveQueryStatus(ctx.Context(), authsession.Session(ctx).UserId, ctx.Params("query"))
	return auditArchiveResponse(job, err)
}

func AuditArchiveQueryResults(ctx fiber.Ctx) error {
	results, err := storytellerService.NewService().AuditArchiveQueryResults(ctx.Context(), authsession.Session(ctx).UserId, ctx.Params("query"), ctx.Query("cursor"))
	return auditArchiveResponse(results, err)
}

func auditArchiveResponse(data any, err error) error {
	switch {
	case err == nil:
		return output.Success(data)
	case repository.IsRecordNotFound(err):
		return output.NotFound(errors.New("找不到這個專案或封存查詢，或你沒有查看的權限"))
	case errors.Is(err, storytellerService.ErrAuditArchiveUnavailable),
		errors.Is(err, storytellerService.ErrAuditArchiveMonthUnavailable),
		errors.Is(err, storytellerService.ErrAuditArchiveSpanTooLong),
		errors.Is(err, storytellerService.ErrAuditArchiveQueryNotReady),
		errors.Is(err, storytellerService.ErrAuditArchiveQueryExpired),
		errors.Is(err, storytellerService.ErrAuditFilterInvalid),
		errors.Is(err, storytellerService.ErrAuditCursorInvalid):
		return output.BadRequest(err)
	default:
		// AWS 端的錯誤可能帶有 bucket、帳號等內部資訊，只寫 log，不回傳原文。
		log.Logger().Error("Storyteller audit archive request failed", zap.Error(err))
		return output.DBError(errors.New("封存查詢暫時無法使用，請稍後再試"))
	}
}
