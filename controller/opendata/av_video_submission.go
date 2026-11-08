package opendata

import (
	"github.com/gofiber/fiber/v3"

	"faryne.dev/controller/helper"
	"faryne.dev/middleware/authsession"
	avEntity "faryne.dev/model/entity/opendata/av"
	"faryne.dev/service/av"
	serviceHelper "faryne.dev/service/helper"
	"faryne.dev/service/output"
	"faryne.dev/service/recaptcha"
)

// AvVideoSubmit 提交影片修改，等管理者審核。不需登入，有登入就記錄提交者；限流與女優上稿共用
// @Summary Submit an AV video edit for review
// @Tags OpenData AV
// @Accept json
// @Produce json
// @Param body body avEntity.VideoSubmitRequest true "Submission"
// @Success 200 {object} output.CommonOutput
// @Failure 400 {object} output.CommonOutput
// @Failure 404 {object} output.CommonOutput
// @Failure 429 {object} output.CommonOutput
// @Router /opendata/av/video/submissions [post]
func AvVideoSubmit(ctx fiber.Ctx) error {
	var req avEntity.VideoSubmitRequest
	if err := helper.BindJSON(ctx, &req); err != nil {
		return err
	}
	if err := verifyAvRecaptcha(ctx, recaptcha.ActionVideoSubmit); err != nil {
		return err
	}
	var userID uint64
	if s := authsession.Session(ctx); s != nil {
		userID = s.UserId
	}
	result, err := av.SubmitVideo(ctx.Context(), req, nil, avEntity.SubmissionChannelWeb, userID, ctx.IP())
	if err != nil {
		return avSubmissionError(err)
	}
	return output.Success(result)
}

// AvVideoSubmissionStatus 查詢一張影片修改單的審核結果
// @Summary Get an AV video submission status
// @Tags OpenData AV
// @Produce json
// @Param id path int true "Submission ID"
// @Success 200 {object} output.CommonOutput
// @Failure 404 {object} output.CommonOutput
// @Router /opendata/av/video/submissions/{id} [get]
func AvVideoSubmissionStatus(ctx fiber.Ctx) error {
	status, err := av.VideoSubmissionStatusByID(submissionIDParam(ctx))
	if err != nil {
		return output.FromError(err)
	}
	return output.Success(status)
}

// AvVideoTermSuggest 影片修改表單的 autocomplete（出演、監督、系列、發售商、品牌、標籤）
// @Summary Suggest existing values for an AV video list field
// @Tags OpenData AV
// @Produce json
// @Param field query string true "actresses / directors / series / makers / labels / tags"
// @Param q query string false "Keyword (contains)"
// @Success 200 {object} output.CommonOutput
// @Failure 400 {object} output.CommonOutput
// @Router /opendata/av/video/suggest [get]
func AvVideoTermSuggest(ctx fiber.Ctx) error {
	var req avEntity.VideoTermSuggestRequest
	if err := helper.BindQuery(ctx, &req); err != nil {
		return err
	}
	rows, err := av.VideoTermSuggest(ctx.Context(), req.Field, req.Q)
	if err != nil {
		return avSubmissionError(err)
	}
	return output.Success(rows)
}

// AdminVideoSubmissions 管理列表（status：pending／approved／rejected）
func AdminVideoSubmissions(ctx fiber.Ctx) error {
	var req avEntity.VideoSubmissionListRequest
	if err := helper.BindQuery(ctx, &req); err != nil {
		return err
	}
	rows, total, err := av.ListVideoSubmissions(ctx.Context(), authsession.Session(ctx).UserId, req)
	if err != nil {
		return avSubmissionError(err)
	}
	return output.Success(serviceHelper.ResultPaginate(ctx, rows, total))
}

// AdminVideoSubmission 審核頁資料（提交內容、提交當下與現在的資料、各種提醒）
func AdminVideoSubmission(ctx fiber.Ctx) error {
	detail, err := av.GetVideoSubmission(ctx.Context(), authsession.Session(ctx).UserId, submissionIDParam(ctx))
	if err != nil {
		return avSubmissionError(err)
	}
	return output.Success(detail)
}

// AdminApproveVideoSubmission 核准（待審核或已否決的單）
func AdminApproveVideoSubmission(ctx fiber.Ctx) error {
	sub, err := av.ApproveVideoSubmission(ctx.Context(), authsession.Session(ctx).UserId, submissionIDParam(ctx))
	if err != nil {
		return avSubmissionError(err)
	}
	return output.Success(sub)
}

// AdminRejectVideoSubmission 否決待審核的單
func AdminRejectVideoSubmission(ctx fiber.Ctx) error {
	var req avEntity.ActressSubmissionRejectRequest
	if err := helper.BindJSON(ctx, &req); err != nil {
		return err
	}
	sub, err := av.RejectVideoSubmission(authsession.Session(ctx).UserId, submissionIDParam(ctx), req.ReviewNote)
	if err != nil {
		return avSubmissionError(err)
	}
	return output.Success(sub)
}
