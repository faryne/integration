package joyu

import (
	"strconv"

	"faryne.dev/middleware/joyuauth"
	"faryne.dev/service/av"
	serviceHelper "faryne.dev/service/helper"
	"faryne.dev/service/output"

	"github.com/gofiber/fiber/v3"
)

// MyUpcoming 即將發售頁「我追蹤的」：符合任一筆追蹤的預約作品
// @Summary Upcoming videos of my follows
// @Tags Joyu
// @Produce json
// @Security BearerAuth
// @Param page query int false "Page number"
// @Success 200 {object} output.CommonOutput
// @Router /joyu/me/upcoming [get]
func MyUpcoming(ctx fiber.Ctx) error {
	page, _ := strconv.Atoi(ctx.Query("page"))
	r, rows, err := av.JoyuFollowUpcoming(ctx.Context(), joyuauth.Token(ctx).UID, page)
	if err != nil {
		return output.FromError(err)
	}
	return output.Success(serviceHelper.ResultPaginate(ctx, rows, r.Total))
}
