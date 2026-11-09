package opendata

import (
	"net/http"

	"faryne.dev/controller/helper"
	avEntity "faryne.dev/model/entity/opendata/av"
	"faryne.dev/service/av"
	serviceHelper "faryne.dev/service/helper"
	"faryne.dev/service/output"

	"github.com/gofiber/fiber/v3"
)

// joyu.fyi 即將發售：DMM 預約作品（每日排程寫進預約索引），條件跟影片搜尋一樣

// AvUpcoming 即將發售列表（一頁 30 筆）
// @Summary Upcoming AV videos (pre-order)
// @Description 沒指定日期時是明天起 30 天（日本時間，end_date 不含當天）；sort 預設 soonest（配信日近的在前、同一天依 DMM 收藏數），popular 依 DMM 收藏數
// @Tags OpenData AV
// @Produce json
// @Param actress query []string false "Actress (repeatable, AND)" collectionFormat(multi)
// @Param maker query []string false "Maker (repeatable, OR)" collectionFormat(multi)
// @Param start_date query string false "Start date in YYYY-MM-DD"
// @Param end_date query string false "End date in YYYY-MM-DD (exclusive)"
// @Param sort query string false "soonest or popular"
// @Param page query int false "Page number"
// @Success 200 {object} output.CommonOutput
// @Router /opendata/av/upcoming [get]
func AvUpcoming(ctx fiber.Ctx) error {
	var req avEntity.VideoQueryRequest
	if err := helper.BindQuery(ctx, &req); err != nil {
		return err
	}
	r, rows, err := av.UpcomingSearch(req)
	if err != nil {
		return output.New(http.StatusInternalServerError, "", nil, err.Error())
	}
	return output.Success(serviceHelper.ResultPaginate(ctx, rows, r.Total))
}

// AvUpcomingDates 即將發售頁的日期列：每天幾部
// @Summary Upcoming AV video counts by date
// @Tags OpenData AV
// @Produce json
// @Success 200 {object} output.CommonOutput
// @Router /opendata/av/upcoming/dates [get]
func AvUpcomingDates(ctx fiber.Ctx) error {
	var req avEntity.VideoQueryRequest
	if err := helper.BindQuery(ctx, &req); err != nil {
		return err
	}
	out, err := av.UpcomingDates(req)
	if err != nil {
		return output.New(http.StatusInternalServerError, "", nil, err.Error())
	}
	return output.Success(out)
}
