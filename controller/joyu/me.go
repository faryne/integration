package joyu

import (
	"errors"
	"net/http"
	"strconv"

	"faryne.dev/controller/helper"
	"faryne.dev/middleware/joyuauth"
	avEntity "faryne.dev/model/entity/opendata/av"
	"faryne.dev/service/auth"
	"faryne.dev/service/av"
	"faryne.dev/service/output"

	"github.com/gofiber/fiber/v3"
)

// joyu.fyi 登入後的個人 API（/joyu/me/*）：全部要帶 joyu-firebase 的 ID token（middleware/joyuauth），全部 no-store

// customCodeFollowLimit 追蹤數量達上限
const customCodeFollowLimit output.CustomCode = "400601"

func followError(err error) error {
	switch {
	case errors.Is(err, av.ErrFollowLimit):
		return output.New(http.StatusBadRequest, customCodeFollowLimit, nil, err.Error())
	case errors.Is(err, av.ErrFollowInvalid):
		return output.New(http.StatusBadRequest, "", nil, err.Error())
	}
	return output.FromError(err)
}

// Follows 全部追蹤（輕量），全站畫愛心狀態用
// @Summary List joyu follows
// @Tags Joyu
// @Produce json
// @Security BearerAuth
// @Success 200 {object} output.CommonOutput
// @Router /joyu/me/follows [get]
func Follows(ctx fiber.Ctx) error {
	rows, err := av.ListJoyuFollows(joyuauth.Token(ctx).UID)
	if err != nil {
		return output.FromError(err)
	}
	return output.Success(rows)
}

// Follow 新增追蹤（已經追蹤就當作成功）
// @Summary Follow an actress / maker / label / series / director / tag / search
// @Tags Joyu
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param body body avEntity.JoyuFollowRequest true "Follow"
// @Success 200 {object} output.CommonOutput
// @Router /joyu/me/follows [put]
func Follow(ctx fiber.Ctx) error {
	var req avEntity.JoyuFollowRequest
	if err := helper.BindJSON(ctx, &req); err != nil {
		return err
	}
	if err := av.AddJoyuFollow(joyuauth.Token(ctx).UID, req); err != nil {
		return followError(err)
	}
	return output.Success(nil)
}

// Unfollow 取消追蹤
// @Summary Unfollow
// @Tags Joyu
// @Accept json
// @Produce json
// @Security BearerAuth
// @Param body body avEntity.JoyuFollowRequest true "Follow"
// @Success 200 {object} output.CommonOutput
// @Router /joyu/me/follows [delete]
func Unfollow(ctx fiber.Ctx) error {
	var req avEntity.JoyuFollowRequest
	if err := helper.BindJSON(ctx, &req); err != nil {
		return err
	}
	if err := av.RemoveJoyuFollow(joyuauth.Token(ctx).UID, req); err != nil {
		return followError(err)
	}
	return output.Success(nil)
}

// Feed 我的追蹤頁：最近 days 天（7／14／30）各追蹤的新片
// @Summary Recent videos of each follow
// @Tags Joyu
// @Produce json
// @Security BearerAuth
// @Param days query int false "7, 14 or 30 (default 14)"
// @Success 200 {object} output.CommonOutput
// @Router /joyu/me/feed [get]
func Feed(ctx fiber.Ctx) error {
	days, _ := strconv.Atoi(ctx.Query("days"))
	feed, err := av.JoyuFollowFeed(ctx.Context(), joyuauth.Token(ctx).UID, days)
	if err != nil {
		return output.FromError(err)
	}
	return output.Success(feed)
}

// Merge 匿名帳號升級時遇到既有的 Google 帳號：把匿名帳號的追蹤與片單搬到目前登入的帳號
// @Summary Merge follows from an anonymous account
// @Tags Joyu
// @Accept json
// @Produce json
// @Security BearerAuth
// @Success 200 {object} output.CommonOutput
// @Router /joyu/me/merge [post]
func Merge(ctx fiber.Ctx) error {
	var req struct {
		AnonymousToken string `json:"anonymous_token"`
	}
	if err := helper.BindJSON(ctx, &req); err != nil {
		return err
	}
	current := joyuauth.Token(ctx)
	// 只能從匿名帳號搬到正式帳號；匿名 token 一樣要驗過，避免拿別人的 uid 來搬
	anon, err := auth.VerifyFirebaseIDToken(req.AnonymousToken, auth.BrandJoyu)
	if err != nil || anon.Provider != "anonymous" || current.Provider == "anonymous" {
		return output.New(http.StatusBadRequest, "", nil, "無法合併這個帳號")
	}
	if err := av.MergeJoyuAccountData(anon.UID, current.UID); err != nil {
		return output.FromError(err)
	}
	return output.Success(nil)
}

// DeleteAccount 刪除帳號的資料（全部追蹤與片單）；Firebase 帳號由前端接著呼叫 user.delete() 刪
// @Summary Delete account data
// @Tags Joyu
// @Produce json
// @Security BearerAuth
// @Success 200 {object} output.CommonOutput
// @Router /joyu/me [delete]
func DeleteAccount(ctx fiber.Ctx) error {
	if err := av.DeleteJoyuAccountData(joyuauth.Token(ctx).UID); err != nil {
		return output.FromError(err)
	}
	return output.Success(nil)
}
