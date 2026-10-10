package storyteller

import (
	"errors"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/repository"
	"faryne.dev/service/output"
	"faryne.dev/service/storyteller"
	"github.com/gofiber/fiber/v3"
)

// 管理後台：檢舉處理。只掛在 session 驗證群組（PAT／MCP／OAuth 不能用），每支 service 方法自己檢查平台權限。

const customCodeAdminForbidden output.CustomCode = "403201"

// adminResponse：沒有平台權限 403、找不到 404、輸入錯誤 400。
func adminResponse(data any, err error) error {
	var validation storyteller.PostValidationError
	switch {
	case err == nil:
		return output.Success(data)
	case errors.Is(err, storyteller.ErrAdminForbidden):
		return output.New(fiber.StatusForbidden, customCodeAdminForbidden, nil, "沒有權限")
	case repository.IsRecordNotFound(err):
		return output.NotFound(errors.New("找不到這個項目"))
	case errors.As(err, &validation):
		return output.BadRequest(validation)
	default:
		return output.DBError(err)
	}
}

func AdminMe(ctx fiber.Ctx) error {
	return adminResponse(storyteller.NewService().AdminMe(sessionUserID(ctx)))
}

func AdminReports(ctx fiber.Ctx) error {
	var query storytellerModel.AdminReportListQuery
	if err := ctx.Bind().Query(&query); err != nil {
		return output.BadRequest(err)
	}
	return adminResponse(storyteller.NewService().AdminReports(sessionUserID(ctx), query))
}

// :type 是對象種類、:target 是對象的 public_id（後台不使用內部流水號）

func AdminReportDetail(ctx fiber.Ctx) error {
	return adminResponse(storyteller.NewService().AdminReportDetail(sessionUserID(ctx), adminTargetType(ctx), ctx.Params("target")))
}

func AdminRemoveReportTarget(ctx fiber.Ctx) error {
	var input storytellerModel.AdminRemoveRequest
	if err := ctx.Bind().Body(&input); err != nil {
		return output.BadRequest(err)
	}
	return adminResponse(nil, storyteller.NewService().AdminRemoveReportTarget(sessionUserID(ctx), adminTargetType(ctx), ctx.Params("target"), input))
}

func AdminDismissReportTarget(ctx fiber.Ctx) error {
	return adminResponse(nil, storyteller.NewService().AdminDismissReportTarget(sessionUserID(ctx), adminTargetType(ctx), ctx.Params("target")))
}

func adminTargetType(ctx fiber.Ctx) storytellerModel.ReportTargetType {
	return storytellerModel.ReportTargetType(ctx.Params("type"))
}
