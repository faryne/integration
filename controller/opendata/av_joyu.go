package opendata

import (
	"faryne.dev/controller/helper"
	avEntity "faryne.dev/model/entity/opendata/av"
	"faryne.dev/service/av"
	"faryne.dev/service/output"
	"github.com/gofiber/fiber/v3"
)

// AvNewActresses joyu.fyi 首頁「今天有新片的女優」
// @Summary AV actresses with new releases today
// @Description 最近一個有配信的日子（日本時間）依出演部數排前 30 位；今天還沒有新片時回傳最近一天，date 是實際採用的日期
// @Tags OpenData AV
// @Produce json
// @Success 200 {object} output.CommonOutput
// @Failure 500 {object} output.CommonOutput
// @Router /opendata/av/home/new-actresses [get]
func AvNewActresses(ctx fiber.Ctx) error {
	out, err := av.NewActressesToday(ctx.Context())
	if err != nil {
		return output.FromError(err)
	}
	return output.Success(out)
}

// AvActressSummary joyu.fyi 女優頁的作品數、出道與最新配信日、共演女優
// @Summary AV actress video summary
// @Tags OpenData AV
// @Produce json
// @Param actress query string true "Actress name on the page URL"
// @Param xcity_id query int false "XCity actress ID"
// @Param manual_id query int false "Manual actress ID"
// @Param dmm_id query string false "DMM actress ID"
// @Success 200 {object} output.CommonOutput
// @Failure 500 {object} output.CommonOutput
// @Router /opendata/av/actress/summary [get]
func AvActressSummary(ctx fiber.Ctx) error {
	var req avEntity.VideoQueryRequest
	if err := helper.BindQuery(ctx, &req); err != nil {
		return err
	}
	out, err := av.ActressVideoSummary(ctx.Context(), req)
	if err != nil {
		return output.FromError(err)
	}
	return output.Success(out)
}

// AvActressesByNames joyu.fyi 影片頁出演女優卡：依出演者名字批次取女優資料
// @Summary AV actresses by credit names
// @Description key 是傳入的原始名字；對不到或同名多位的不會出現在結果裡。最多 100 個名字
// @Tags OpenData AV
// @Produce json
// @Param name query []string true "Credit names (repeatable)" collectionFormat(multi)
// @Success 200 {object} output.CommonOutput
// @Failure 500 {object} output.CommonOutput
// @Router /opendata/av/actress/by-names [get]
func AvActressesByNames(ctx fiber.Ctx) error {
	var req struct {
		Name []string `query:"name"`
	}
	if err := helper.BindQuery(ctx, &req); err != nil {
		return err
	}
	out, err := av.ActressesByNames(req.Name)
	if err != nil {
		return output.FromError(err)
	}
	return output.Success(out)
}

// AvVideoMarkSummary joyu.fyi 影片頁的片單統計
// @Summary Want / watched counts and rating of a video
// @Description 評分人數少於 3 人時 rating_avg 為 null
// @Tags OpenData AV
// @Produce json
// @Param no path string true "DMM content id"
// @Success 200 {object} output.CommonOutput
// @Failure 400 {object} output.CommonOutput
// @Router /opendata/av/video/{no}/marks-summary [get]
func AvVideoMarkSummary(ctx fiber.Ctx) error {
	out, err := av.JoyuMarkSummary(ctx.Params("no"))
	if err != nil {
		return output.FromError(err)
	}
	return output.Success(out)
}
