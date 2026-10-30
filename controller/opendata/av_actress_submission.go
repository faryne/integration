package opendata

import (
	"errors"
	"fmt"
	"math"
	"net/http"
	"strconv"

	"github.com/gofiber/fiber/v3"

	"faryne.dev/controller/helper"
	"faryne.dev/middleware/authsession"
	avEntity "faryne.dev/model/entity/opendata/av"
	authService "faryne.dev/service/auth"
	"faryne.dev/service/av"
	serviceHelper "faryne.dev/service/helper"
	"faryne.dev/service/output"
)

// customCodeAvActressSubmitLimited 這個 IP 一小時內的上稿次數用完
const customCodeAvActressSubmitLimited output.CustomCode = "429006"

// AvActressSubmit 提交女優新增／修改，等管理者審核。不需登入，有登入就記錄提交者
// @Summary Submit an AV actress create/edit for review
// @Tags OpenData AV
// @Accept json
// @Produce json
// @Param body body avEntity.ActressSubmitRequest true "Submission"
// @Success 200 {object} output.CommonOutput
// @Failure 400 {object} output.CommonOutput
// @Failure 404 {object} output.CommonOutput
// @Failure 429 {object} output.CommonOutput
// @Router /opendata/av/actress/submissions [post]
func AvActressSubmit(ctx fiber.Ctx) error {
	var req avEntity.ActressSubmitRequest
	if err := helper.BindJSON(ctx, &req); err != nil {
		return err
	}
	var userID uint64
	if s := authsession.Session(ctx); s != nil {
		userID = s.UserId
	}
	result, err := av.SubmitActress(req, nil, avEntity.SubmissionChannelWeb, userID, ctx.IP())
	if err != nil {
		return actressSubmissionError(err)
	}
	return output.Success(result)
}

// AvActressSubmissionStatus 查詢一張提交單的審核結果
// @Summary Get an AV actress submission status
// @Tags OpenData AV
// @Produce json
// @Param id path int true "Submission ID"
// @Success 200 {object} output.CommonOutput
// @Failure 404 {object} output.CommonOutput
// @Router /opendata/av/actress/submissions/{id} [get]
func AvActressSubmissionStatus(ctx fiber.Ctx) error {
	status, err := av.ActressSubmissionStatusByID(submissionIDParam(ctx))
	if err != nil {
		return output.FromError(err)
	}
	return output.Success(status)
}

// AdminActressSubmissions 管理列表（status：pending／approved／rejected）
func AdminActressSubmissions(ctx fiber.Ctx) error {
	var req avEntity.ActressSubmissionListRequest
	if err := helper.BindQuery(ctx, &req); err != nil {
		return err
	}
	rows, total, err := av.ListActressSubmissions(authsession.Session(ctx).UserId, req)
	if err != nil {
		return actressSubmissionError(err)
	}
	return output.Success(serviceHelper.ResultPaginate(ctx, rows, total))
}

// AdminActressSubmission 審核頁資料（提交內容、提交當下與現在的資料、同名女優）
func AdminActressSubmission(ctx fiber.Ctx) error {
	detail, err := av.GetActressSubmission(authsession.Session(ctx).UserId, submissionIDParam(ctx))
	if err != nil {
		return actressSubmissionError(err)
	}
	return output.Success(detail)
}

// AdminApproveActressSubmission 核准（待審核或已否決的單）
func AdminApproveActressSubmission(ctx fiber.Ctx) error {
	var req avEntity.ActressSubmissionApproveRequest
	if err := helper.BindJSON(ctx, &req); err != nil {
		return err
	}
	sub, err := av.ApproveActressSubmission(ctx.Context(), authsession.Session(ctx).UserId, submissionIDParam(ctx), req.MergeTarget)
	if err != nil {
		return actressSubmissionError(err)
	}
	return output.Success(sub)
}

// AdminRejectActressSubmission 否決待審核的單
func AdminRejectActressSubmission(ctx fiber.Ctx) error {
	var req avEntity.ActressSubmissionRejectRequest
	if err := helper.BindJSON(ctx, &req); err != nil {
		return err
	}
	sub, err := av.RejectActressSubmission(authsession.Session(ctx).UserId, submissionIDParam(ctx), req.ReviewNote)
	if err != nil {
		return actressSubmissionError(err)
	}
	return output.Success(sub)
}

func submissionIDParam(ctx fiber.Ctx) uint64 {
	id, _ := strconv.ParseUint(ctx.Params("id"), 10, 64)
	return id
}

// actressSubmissionError 上稿／審核的錯誤轉成對應的 HTTP 狀態；訊息本身已是給使用者看的中文
func actressSubmissionError(err error) error {
	switch {
	case errors.Is(err, av.ErrActressSubmitLimited):
		var limit av.ActressSubmitLimitError
		minutes := 60
		if errors.As(err, &limit) {
			minutes = max(int(math.Ceil(limit.RetryAfter.Minutes())), 1)
		}
		return output.New(http.StatusTooManyRequests, customCodeAvActressSubmitLimited, nil, fmt.Sprintf("上稿次數已達上限，請 %d 分鐘後再試", minutes))
	case errors.Is(err, authService.ErrAdminRequired):
		return output.New(http.StatusForbidden, "", nil, "需要管理者權限")
	case errors.Is(err, av.ErrActressTargetNotFound):
		return output.New(http.StatusNotFound, "", nil, err.Error())
	case errors.Is(err, av.ErrSubmissionNotReviewable):
		return output.New(http.StatusConflict, "", nil, err.Error())
	case errors.Is(err, av.ErrActressWritesDisabled):
		return output.New(http.StatusServiceUnavailable, "", nil, err.Error())
	case errors.Is(err, av.ErrActressInvalid), errors.Is(err, av.ErrActressNoChanges),
		errors.Is(err, av.ErrActressTargetAmbiguous), errors.Is(err, av.ErrMergeTargetRequired):
		return output.New(http.StatusBadRequest, "", nil, err.Error())
	}
	return output.FromError(err)
}
