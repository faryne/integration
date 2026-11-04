package nekomaid

import (
	"errors"
	"net/http"
	"strconv"

	"faryne.dev/controller/helper"
	"faryne.dev/middleware/authsession"
	nekomaidEntity "faryne.dev/model/entity/nekomaid"
	authService "faryne.dev/service/auth"
	serviceHelper "faryne.dev/service/helper"
	"faryne.dev/service/nekomaid"
	"faryne.dev/service/output"
	"github.com/gofiber/fiber/v3"
)

// AdminForbiddenList 整合後台：禁抓名單列表
func AdminForbiddenList(ctx fiber.Ctx) error {
	var input nekomaidEntity.ForbiddenSearchRequest
	if err := helper.BindQuery(ctx, &input); err != nil {
		return err
	}
	rows, total, err := nekomaid.SearchForbidden(authsession.Session(ctx).UserId, input)
	if err != nil {
		return forbiddenError(err)
	}
	return output.Success(serviceHelper.ResultPaginate(ctx, rows, total))
}

// AdminCreateForbidden 整合後台：新增禁抓（整個畫師或單一作品），之後由同步 job 把已抓的作品從 ES 拉掉
func AdminCreateForbidden(ctx fiber.Ctx) error {
	var input nekomaidEntity.ForbiddenCreateRequest
	if err := helper.BindJSON(ctx, &input); err != nil {
		return err
	}
	row, err := nekomaid.CreateForbidden(authsession.Session(ctx).UserId, input)
	if err != nil {
		return forbiddenError(err)
	}
	return output.Success(row)
}

// AdminDeleteForbidden 整合後台：解除禁抓（soft delete），之後由同步 job 回補 ES
func AdminDeleteForbidden(ctx fiber.Ctx) error {
	id, _ := strconv.ParseUint(ctx.Params("id"), 10, 64)
	if err := nekomaid.DeleteForbidden(authsession.Session(ctx).UserId, id); err != nil {
		return forbiddenError(err)
	}
	return output.Success(nil)
}

// forbiddenError 權限與驗證錯誤自己處理（訊息是給管理員看的中文），其他交給 FromError（查無資料 404）
func forbiddenError(err error) error {
	switch {
	case errors.Is(err, authService.ErrAdminRequired):
		return output.New(http.StatusForbidden, "", nil, "需要管理者權限")
	case errors.Is(err, nekomaid.ErrForbiddenInvalid):
		return output.New(http.StatusBadRequest, "", nil, err.Error())
	}
	return output.FromError(err)
}

// AdminForbiddenSubmissions 整合後台：版權申告審核列表
func AdminForbiddenSubmissions(ctx fiber.Ctx) error {
	var input nekomaidEntity.ForbiddenSubmissionSearchRequest
	if err := helper.BindQuery(ctx, &input); err != nil {
		return err
	}
	rows, total, err := nekomaid.SearchForbiddenSubmissions(authsession.Session(ctx).UserId, input)
	if err != nil {
		return forbiddenError(err)
	}
	return output.Success(serviceHelper.ResultPaginate(ctx, rows, total))
}

// AdminApproveForbiddenSubmission 整合後台：核准申告，寫進禁抓名單後由同步 job 拉掉 ES
func AdminApproveForbiddenSubmission(ctx fiber.Ctx) error {
	return reviewForbiddenSubmission(ctx, nekomaid.ApproveForbiddenSubmission)
}

// AdminRejectForbiddenSubmission 整合後台：駁回申告（理由必填，會顯示在申請人的查詢頁）
func AdminRejectForbiddenSubmission(ctx fiber.Ctx) error {
	return reviewForbiddenSubmission(ctx, nekomaid.RejectForbiddenSubmission)
}

func reviewForbiddenSubmission(ctx fiber.Ctx, review func(userID, id uint64, note string) error) error {
	var input nekomaidEntity.ForbiddenSubmissionReviewRequest
	if err := helper.BindJSON(ctx, &input); err != nil {
		return err
	}
	id, _ := strconv.ParseUint(ctx.Params("id"), 10, 64)
	if err := review(authsession.Session(ctx).UserId, id, input.Note); err != nil {
		return forbiddenError(err)
	}
	return output.Success(nil)
}
