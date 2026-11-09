package joyu

import (
	"errors"
	"net/http"

	"faryne.dev/controller/helper"
	"faryne.dev/middleware/joyuauth"
	avEntity "faryne.dev/model/entity/opendata/av"
	"faryne.dev/service/av"
	serviceHelper "faryne.dev/service/helper"
	"faryne.dev/service/output"

	"github.com/gofiber/fiber/v3"
)

// joyu.fyi 片單（想看／看過＋評分）的個人 API

// customCodeMarkLimit 片單數量達上限
const customCodeMarkLimit output.CustomCode = "400602"

func markError(err error) error {
	switch {
	case errors.Is(err, av.ErrMarkLimit):
		return output.New(http.StatusBadRequest, customCodeMarkLimit, nil, err.Error())
	case errors.Is(err, av.ErrMarkInvalid):
		return output.New(http.StatusBadRequest, "", nil, err.Error())
	}
	return output.FromError(err)
}

// Marks 全部片單（輕量），全站卡片小標與影片頁按鈕狀態用
// @Summary List joyu video marks
// @Tags Joyu
// @Produce json
// @Security BearerAuth
// @Success 200 {object} output.CommonOutput
// @Router /joyu/me/marks [get]
func Marks(ctx fiber.Ctx) error {
	rows, err := av.ListJoyuMarks(joyuauth.Token(ctx).UID)
	if err != nil {
		return output.FromError(err)
	}
	return output.Success(rows)
}

// MarkedVideos 我的片單頁（帶影片資料）
// @Summary Marked videos
// @Tags Joyu
// @Produce json
// @Security BearerAuth
// @Param status query string true "want or watched"
// @Param rating query string false "5, 4, le3 or none"
// @Param sort query string false "empty (added) or date"
// @Param page query int false "Page"
// @Success 200 {object} output.CommonOutput
// @Router /joyu/me/marks/videos [get]
func MarkedVideos(ctx fiber.Ctx) error {
	var req avEntity.JoyuMarkedVideosRequest
	if err := helper.BindQuery(ctx, &req); err != nil {
		return err
	}
	rows, total, err := av.JoyuMarkedVideos(ctx.Context(), joyuauth.Token(ctx).UID, req)
	if err != nil {
		return markError(err)
	}
	return output.Success(serviceHelper.ResultPaginate(ctx, rows, total))
}

// SetMark 設定想看／看過與評分
// @Summary Set a video mark
// @Tags Joyu
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param no path string true "DMM content id"
// @Param body body avEntity.JoyuVideoMarkRequest true "Mark"
// @Success 200 {object} output.CommonOutput
// @Router /joyu/me/marks/{no} [put]
func SetMark(ctx fiber.Ctx) error {
	var req avEntity.JoyuVideoMarkRequest
	if err := helper.BindJSON(ctx, &req); err != nil {
		return err
	}
	if err := av.SetJoyuMark(joyuauth.Token(ctx).UID, ctx.Params("no"), req); err != nil {
		return markError(err)
	}
	return output.Success(nil)
}

// RemoveMark 從片單移除
// @Summary Remove a video mark
// @Tags Joyu
// @Produce json
// @Security BearerAuth
// @Param no path string true "DMM content id"
// @Success 200 {object} output.CommonOutput
// @Router /joyu/me/marks/{no} [delete]
func RemoveMark(ctx fiber.Ctx) error {
	if err := av.RemoveJoyuMark(joyuauth.Token(ctx).UID, ctx.Params("no")); err != nil {
		return markError(err)
	}
	return output.Success(nil)
}
