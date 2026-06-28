package opendata

import (
	"net/http"
	"strconv"
	"time"

	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v3"

	"faryne.dev/controller/helper"
	avEntity "faryne.dev/model/entity/opendata/av"
	"faryne.dev/service/av"
	"faryne.dev/service/dmm"
	serviceHelper "faryne.dev/service/helper"
	"faryne.dev/service/output"
	"faryne.dev/service/xcity"
)

// AvVideoSearch searches AV video records.
// @Summary Search AV videos
// @Tags OpenData AV
// @Produce json
// @Param year query int false "Release year"
// @Param month query int false "Release month"
// @Param day query int false "Release day"
// @Param start_date query string false "Start date in YYYY-MM-DD"
// @Param end_date query string false "End date in YYYY-MM-DD"
// @Param keyword query string false "Keyword"
// @Param tag query string false "Tag"
// @Param actress query string false "Actress name"
// @Param no query string false "Video number"
// @Param page query int false "Page number"
// @Success 200 {object} output.CommonOutput
// @Failure 400 {object} output.CommonOutput
// @Failure 500 {object} output.CommonOutput
// @Router /opendata/av/search/video [get]
func AvVideoSearch(ctx fiber.Ctx) error {
	var req avEntity.VideoQueryRequest
	if err := helper.BindQuery(ctx, &req); err != nil {
		return err
	}
	r, rows, err := av.VideoSearch(req)
	if err != nil {
		return output.New(http.StatusInternalServerError, "", nil, err.Error())
	}
	return output.Success(serviceHelper.ResultPaginate(ctx, rows, r.Hits.Total.Value))
}

// AvActressSearch searches AV actress records.
// @Summary Search AV actresses
// @Tags OpenData AV
// @Produce json
// @Param cup query string false "Cup"
// @Param b query []int false "Bust range" collectionFormat(multi)
// @Param w query []int false "Waist range" collectionFormat(multi)
// @Param h query []int false "Hip range" collectionFormat(multi)
// @Param height query []int false "Height range" collectionFormat(multi)
// @Param name query string false "Name"
// @Param birth_year query int false "Birth year"
// @Param birth_month query int false "Birth month"
// @Param birth_day query int false "Birth day"
// @Param blood_type query string false "Blood type"
// @Param page query int false "Page number"
// @Success 200 {object} output.CommonOutput
// @Failure 400 {object} output.CommonOutput
// @Failure 500 {object} output.CommonOutput
// @Router /opendata/av/search/actress [get]
func AvActressSearch(ctx fiber.Ctx) error {
	var req avEntity.ActressQueryRequest
	if err := helper.BindQuery(ctx, &req); err != nil {
		return err
	}
	r, rows, err := av.ActressSearch(req)
	if err != nil {
		return output.New(http.StatusInternalServerError, "", nil, err.Error())
	}
	return output.Success(serviceHelper.ResultPaginate(ctx, rows, r.Hits.Total.Value))
}

// DMMDailyVideo lists DMM daily videos.
// @Summary List DMM daily videos
// @Tags OpenData AV
// @Produce json
// @Param date query string true "Date in YYYY-MM-DD"
// @Param page query int false "Page number"
// @Success 200 {object} output.CommonOutput
// @Failure 400 {object} output.CommonOutput
// @Failure 500 {object} output.CommonOutput
// @Router /dmm/avsearch [get]
func DMMDailyVideo(ctx fiber.Ctx) error {
	dParams := ctx.Query("date", "")
	_, err := time.Parse(time.DateOnly, dParams)
	if err != nil {
		return output.BadRequest(err)
	}
	page, pageError := strconv.Atoi(ctx.Query("page", "1"))
	if pageError != nil {
		return output.BadRequest(pageError)
	}
	dmmInstance := dmm.NewDMMClient()

	videos, videosError := dmmInstance.SearchVideosByDaily(dParams, page)
	if videosError != nil {
		return output.New(http.StatusInternalServerError, "", nil, videosError.Error())
	}
	var finalResponse = dmm.DmmVideosList{Videos: videos}
	return output.Success(finalResponse)

}

// XCityActressList lists XCity actresses.
// @Summary List XCity actresses
// @Tags OpenData XCity
// @Produce json
// @Param syllabus query string true "Syllabus"
// @Param page query int true "Page number"
// @Success 200 {object} output.CommonOutput
// @Failure 400 {object} output.CommonOutput
// @Failure 500 {object} output.CommonOutput
// @Router /opendata/xcity/actress [get]
func XCityActressList(ctx fiber.Ctx) error {
	var req avEntity.ActressQuery
	if err := helper.BindQuery(ctx, &req); err != nil {
		return err
	}
	if err := validator.New().Struct(&req); err != nil {
		return output.BadRequest(err)
	}

	rows, err := xcity.ActressList(req.Syllabus, req.Page)
	if err != nil {
		return output.DBError(err)
	}
	return output.Success(rows)
}

// XCityActressDetail returns one XCity actress detail.
// @Summary Get XCity actress detail
// @Tags OpenData XCity
// @Produce json
// @Param id path string true "Actress ID"
// @Success 200 {object} output.CommonOutput
// @Router /opendata/xcity/actress/detail/{id} [get]
func XCityActressDetail(ctx fiber.Ctx) error {
	id := ctx.Params("id")
	actress, _ := xcity.GetActressDetail(id)
	return output.Success(actress)
}
