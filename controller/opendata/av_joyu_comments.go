package opendata

import (
	"errors"
	"net/http"
	"strconv"

	"faryne.dev/service/av"
	"faryne.dev/service/output"

	"github.com/gofiber/fiber/v3"
)

// joyu.fyi 討論版的公開 API：不需登入，不含 uid 與 IP；no-store（剛送出的留言要馬上看得到）

// AvComments 一頁頂層留言（新的在前），每則帶最新 3 則回覆
// @Summary Joyu comments of an actress or a video
// @Tags OpenData AV
// @Produce json
// @Param target query string true "video:{dmm content id} or actress:{domain}:{aid}"
// @Param page query int false "Page"
// @Success 200 {object} output.CommonOutput
// @Failure 400 {object} output.CommonOutput
// @Router /opendata/av/comments [get]
func AvComments(ctx fiber.Ctx) error {
	page, _ := strconv.Atoi(ctx.Query("page"))
	out, err := av.ListJoyuComments(ctx.Query("target"), page)
	if err != nil {
		if errors.Is(err, av.ErrCommentInvalid) {
			return output.New(http.StatusBadRequest, "", nil, err.Error())
		}
		return output.FromError(err)
	}
	return output.Success(out)
}

// AvCommentReplies 一則頂層留言的全部回覆（先舊後新）
// @Summary Replies of a joyu comment
// @Tags OpenData AV
// @Produce json
// @Param id path int true "Comment id"
// @Success 200 {object} output.CommonOutput
// @Router /opendata/av/comments/{id}/replies [get]
func AvCommentReplies(ctx fiber.Ctx) error {
	id, _ := strconv.ParseUint(ctx.Params("id"), 10, 64)
	out, err := av.JoyuCommentReplies(id)
	if err != nil {
		return output.FromError(err)
	}
	return output.Success(out)
}
