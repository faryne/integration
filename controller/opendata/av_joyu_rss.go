package opendata

import (
	"errors"

	"faryne.dev/controller/helper"
	avEntity "faryne.dev/model/entity/opendata/av"
	"faryne.dev/service/av"
	"faryne.dev/service/output"
	"faryne.dev/service/rss"

	"github.com/gofiber/fiber/v3"
)

// joyu.fyi 的 RSS：nginx 把 joyu.fyi/feed/* 轉到這裡（/opendata/av/feed/*），回傳 RSS 2.0 XML

// AvRSSNew 最新配信的 100 部
// @Summary joyu.fyi RSS: latest videos
// @Tags OpenData AV
// @Produce xml
// @Success 200 {string} string
// @Router /opendata/av/feed/new [get]
func AvRSSNew(ctx fiber.Ctx) error {
	return sendRSS(ctx)(av.JoyuRSSNew(ctx))
}

// AvRSSUpcoming 明天起一段期間內最受期待（DMM 收藏數）的 100 部預約作品
// @Summary joyu.fyi RSS: upcoming videos
// @Tags OpenData AV
// @Produce xml
// @Param range query string false "1day, 1week (default) or 1month"
// @Success 200 {string} string
// @Failure 400 {object} output.CommonOutput
// @Router /opendata/av/feed/upcoming [get]
func AvRSSUpcoming(ctx fiber.Ctx) error {
	body, err := av.JoyuRSSUpcoming(ctx, ctx.Query("range"))
	if errors.Is(err, av.ErrJoyuRSSRange) {
		return output.BadRequest(err)
	}
	return sendRSS(ctx)(body, err)
}

// AvRSSActress 這位女優最新配信的 100 部（參數同女優頁：xcity_id／manual_id／dmm_id）
// @Summary joyu.fyi RSS: latest videos of an actress
// @Tags OpenData AV
// @Produce xml
// @Param name path string true "Actress name"
// @Param xcity_id query int false "XCity actress ID"
// @Param manual_id query int false "Manual actress ID"
// @Param dmm_id query string false "DMM actress ID"
// @Success 200 {string} string
// @Router /opendata/av/feed/actress/{name} [get]
func AvRSSActress(ctx fiber.Ctx) error {
	var ref avEntity.VideoQueryRequest
	if err := helper.BindQuery(ctx, &ref); err != nil {
		return err
	}
	return sendRSS(ctx)(av.JoyuRSSActress(ctx, ctx.Params("name"), ref))
}

// sendRSS 送出 RSS；查索引失敗照 ES 錯誤回 JSON
func sendRSS(ctx fiber.Ctx) func(string, error) error {
	return func(body string, err error) error {
		if err != nil {
			return output.ESError(err)
		}
		ctx.Set(fiber.HeaderContentType, rss.ContentType)
		return ctx.SendString(body)
	}
}
