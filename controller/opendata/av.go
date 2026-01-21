package opendata

import (
	avEntity "faryne.dev/model/entity/opendata/av"
	"faryne.dev/service/av"
	"faryne.dev/service/dmm"
	"faryne.dev/service/output"
	"faryne.dev/service/xcity"
	"github.com/go-playground/validator/v10"
	"github.com/gofiber/fiber/v3"
	"net/http"
	"strconv"
	"time"
)

func AvVideoSearch(ctx fiber.Ctx) error {
	var req avEntity.VideoQueryRequest
	if err := ctx.Bind().Query(&req); err != nil {
		return output.BadRequest(err)
	}
	_, rows, err := av.VideoSearch(req)
	if err != nil {
		return output.New(http.StatusInternalServerError, "", nil, err.Error())
	}
	return output.Success(rows)
}

func AvActressSearch(ctx fiber.Ctx) error {
	var req avEntity.ActressQueryRequest
	if err := ctx.Bind().Query(&req); err != nil {
		return output.BadRequest(err)
	}
	_, rows, err := av.ActressSearch(req)
	if err != nil {
		return output.New(http.StatusInternalServerError, "", nil, err.Error())
	}
	return output.Success(rows)
}

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

func XCityActressList(ctx fiber.Ctx) error {
	var req avEntity.ActressQuery
	if err := ctx.Bind().Query(&req); err != nil {
		return output.BadRequest(err)
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

func XCityActressDetail(ctx fiber.Ctx) error {
	id := ctx.Params("id")
	actress, _ := xcity.GetActressDetail(id)
	return output.Success(actress)
}
