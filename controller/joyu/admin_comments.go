package joyu

import (
	"errors"
	"net/http"
	"strconv"

	"faryne.dev/controller/helper"
	"faryne.dev/middleware/authsession"
	avEntity "faryne.dev/model/entity/opendata/av"
	authService "faryne.dev/service/auth"
	"faryne.dev/service/av"
	serviceHelper "faryne.dev/service/helper"
	"faryne.dev/service/output"

	"github.com/gofiber/fiber/v3"
)

// joyu 討論版的後台管理（/admin/joyu/*）：主站登入且 users.is_admin

func adminError(err error) error {
	if errors.Is(err, authService.ErrAdminRequired) {
		return output.New(http.StatusForbidden, "", nil, "需要管理者權限")
	}
	return commentError(err)
}

func adminID(ctx fiber.Ctx) uint64 {
	return authsession.Session(ctx).UserId
}

// AdminComments 被檢舉的（tab=reported）或最新的留言
// @Summary Joyu comments for moderation
// @Tags Admin Joyu
// @Produce json
// @Param tab query string false "reported or latest"
// @Param page query int false "Page"
// @Success 200 {object} output.CommonOutput
// @Router /admin/joyu/comments [get]
func AdminComments(ctx fiber.Ctx) error {
	page, _ := strconv.Atoi(ctx.Query("page"))
	rows, total, err := av.AdminJoyuComments(adminID(ctx), ctx.Query("tab"), page)
	if err != nil {
		return adminError(err)
	}
	return output.Success(serviceHelper.ResultPaginate(ctx, rows, total))
}

// AdminDeleteComment 管理員刪除留言
// @Summary Delete a joyu comment
// @Tags Admin Joyu
// @Produce json
// @Param id path int true "Comment id"
// @Success 200 {object} output.CommonOutput
// @Router /admin/joyu/comments/{id} [delete]
func AdminDeleteComment(ctx fiber.Ctx) error {
	id, _ := strconv.ParseUint(ctx.Params("id"), 10, 64)
	if err := av.AdminDeleteJoyuComment(adminID(ctx), id); err != nil {
		return adminError(err)
	}
	return output.Success(nil)
}

// AdminBans 還有效的封鎖名單
// @Summary Active joyu bans
// @Tags Admin Joyu
// @Produce json
// @Success 200 {object} output.CommonOutput
// @Router /admin/joyu/bans [get]
func AdminBans(ctx fiber.Ctx) error {
	rows, err := av.AdminJoyuBans(adminID(ctx))
	if err != nil {
		return adminError(err)
	}
	return output.Success(rows)
}

// AdminBan 封鎖 uid 或 IP（days 為 0 是永久）
// @Summary Ban a joyu uid or IP
// @Tags Admin Joyu
// @Accept json
// @Produce json
// @Param body body avEntity.JoyuBanRequest true "Ban"
// @Success 200 {object} output.CommonOutput
// @Router /admin/joyu/bans [post]
func AdminBan(ctx fiber.Ctx) error {
	var req avEntity.JoyuBanRequest
	if err := helper.BindJSON(ctx, &req); err != nil {
		return err
	}
	if err := av.AdminBanJoyu(adminID(ctx), req); err != nil {
		return adminError(err)
	}
	return output.Success(nil)
}

// AdminLiftBan 解除封鎖
// @Summary Lift a joyu ban
// @Tags Admin Joyu
// @Produce json
// @Param id path int true "Ban id"
// @Success 200 {object} output.CommonOutput
// @Router /admin/joyu/bans/{id} [delete]
func AdminLiftBan(ctx fiber.Ctx) error {
	id, _ := strconv.ParseUint(ctx.Params("id"), 10, 64)
	if err := av.AdminLiftJoyuBan(adminID(ctx), id); err != nil {
		return adminError(err)
	}
	return output.Success(nil)
}
