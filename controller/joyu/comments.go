package joyu

import (
	"errors"
	"net/http"
	"strconv"

	"faryne.dev/controller/helper"
	"faryne.dev/middleware/joyuauth"
	avEntity "faryne.dev/model/entity/opendata/av"
	"faryne.dev/service/av"
	"faryne.dev/service/output"

	"github.com/gofiber/fiber/v3"
)

// joyu.fyi 討論版與個人資料的個人 API（要帶 joyu ID token，匿名帳號也可以）

// recaptchaHeader 匿名帳號留言時前端放 reCAPTCHA token 的 header（跟上稿一樣）
const recaptchaHeader = "X-Recaptcha-Token"

const (
	customCodeCommentBanned      output.CustomCode = "403601"
	customCodeCommentRateLimited output.CustomCode = "429601"
	customCodeCommentRecaptcha   output.CustomCode = "400603"
)

func commentError(err error) error {
	switch {
	case errors.Is(err, av.ErrCommentBanned), errors.Is(err, av.ErrProfileAnonymous):
		code := customCodeCommentBanned
		if errors.Is(err, av.ErrProfileAnonymous) {
			code = ""
		}
		return output.New(http.StatusForbidden, code, nil, err.Error())
	case errors.Is(err, av.ErrCommentRateLimited):
		return output.New(http.StatusTooManyRequests, customCodeCommentRateLimited, nil, err.Error())
	case errors.Is(err, av.ErrCommentRecaptcha):
		return output.New(http.StatusBadRequest, customCodeCommentRecaptcha, nil, err.Error())
	case errors.Is(err, av.ErrCommentNotFound):
		return output.New(http.StatusNotFound, "", nil, err.Error())
	case errors.Is(err, av.ErrCommentInvalid), errors.Is(err, av.ErrCommentTooLong), errors.Is(err, av.ErrCommentHTML),
		errors.Is(err, av.ErrReportInvalid), errors.Is(err, av.ErrNicknameInvalid), errors.Is(err, av.ErrBanInvalid):
		return output.New(http.StatusBadRequest, "", nil, err.Error())
	}
	return output.FromError(err)
}

// PostComment 送出留言或回覆；匿名帳號要帶 X-Recaptcha-Token
// @Summary Post a comment
// @Tags Joyu
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param body body avEntity.JoyuCommentRequest true "Comment"
// @Success 200 {object} output.CommonOutput
// @Router /joyu/me/comments [post]
func PostComment(ctx fiber.Ctx) error {
	var req avEntity.JoyuCommentRequest
	if err := helper.BindJSON(ctx, &req); err != nil {
		return err
	}
	t := joyuauth.Token(ctx)
	v, err := av.PostJoyuComment(ctx.Context(), av.JoyuCommentPoster{
		UID: t.UID, IsAnonymous: t.Provider == "anonymous", IP: helper.ClientIP(ctx), Recaptcha: ctx.Get(recaptchaHeader),
	}, req)
	if err != nil {
		return commentError(err)
	}
	return output.Success(v)
}

// ReportComment 檢舉留言（同一人對同一則只算一次）
// @Summary Report a comment
// @Tags Joyu
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param id path int true "Comment id"
// @Param body body avEntity.JoyuCommentReportRequest true "Reason: spam, harass, privacy or other"
// @Success 200 {object} output.CommonOutput
// @Router /joyu/me/comments/{id}/report [post]
func ReportComment(ctx fiber.Ctx) error {
	var req avEntity.JoyuCommentReportRequest
	if err := helper.BindJSON(ctx, &req); err != nil {
		return err
	}
	id, _ := strconv.ParseUint(ctx.Params("id"), 10, 64)
	if err := av.ReportJoyuComment(joyuauth.Token(ctx).UID, helper.ClientIP(ctx), id, req.Reason); err != nil {
		return commentError(err)
	}
	return output.Success(nil)
}

// Profile 個人資料（暱稱、目前顯示的名字、能不能改）
// @Summary Joyu profile
// @Tags Joyu
// @Produce json
// @Security BearerAuth
// @Success 200 {object} output.CommonOutput
// @Router /joyu/me/profile [get]
func Profile(ctx fiber.Ctx) error {
	t := joyuauth.Token(ctx)
	p, err := av.JoyuProfileOf(t.UID, t.Provider == "anonymous")
	if err != nil {
		return output.FromError(err)
	}
	return output.Success(p)
}

// SetProfile 改暱稱（只限 Google 帳號）
// @Summary Update nickname
// @Tags Joyu
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param body body avEntity.JoyuProfileRequest true "Profile"
// @Success 200 {object} output.CommonOutput
// @Router /joyu/me/profile [put]
func SetProfile(ctx fiber.Ctx) error {
	var req avEntity.JoyuProfileRequest
	if err := helper.BindJSON(ctx, &req); err != nil {
		return err
	}
	t := joyuauth.Token(ctx)
	if err := av.SetJoyuNickname(t.UID, t.Provider == "anonymous", req.Nickname); err != nil {
		return commentError(err)
	}
	return Profile(ctx)
}
