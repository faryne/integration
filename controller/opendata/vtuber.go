package opendata

import (
	"errors"
	"fmt"
	"strconv"

	"github.com/gofiber/fiber/v3"

	"faryne.dev/controller/helper"
	vtuberEntity "faryne.dev/model/entity/opendata/vtuber"
	"faryne.dev/service/output"
	vtuberService "faryne.dev/service/vtuber"
)

// VtuberChannels lists tracked hololive channels for the talent picker.
// @Summary List VTuber channels
// @Tags OpenData VTuber
// @Produce json
// @Success 200 {object} output.CommonOutput
// @Failure 500 {object} output.CommonOutput
// @Router /opendata/vtubers/channels [get]
func VtuberChannels(_ fiber.Ctx) error {
	result, err := vtuberService.ListChannels()
	if err != nil {
		return output.DBError(err)
	}
	return output.Success(result)
}

// VtuberChannel shows a talent's profile, stats and calendar links.
// @Summary Get VTuber channel detail
// @Tags OpenData VTuber
// @Produce json
// @Param handle path string true "YouTube @handle"
// @Success 200 {object} output.CommonOutput
// @Failure 404 {object} output.CommonOutput
// @Router /opendata/vtubers/channels/{handle} [get]
func VtuberChannel(ctx fiber.Ctx) error {
	handle := ctx.Params("handle")
	detail, err := vtuberService.GetChannelDetail(handle)
	if err != nil {
		return output.DBError(err)
	}
	if detail == nil {
		return output.NotFound(fmt.Errorf("channel %s not found", handle))
	}
	return output.Success(detail)
}

// VtuberChannelStats lists a channel's daily statistics.
// @Summary List VTuber channel daily stats
// @Tags OpenData VTuber
// @Produce json
// @Param handle path string true "YouTube @handle"
// @Param days query int false "Days to look back, default 90, at most 365"
// @Success 200 {object} output.CommonOutput
// @Failure 400 {object} output.CommonOutput
// @Failure 404 {object} output.CommonOutput
// @Router /opendata/vtubers/channels/{handle}/stats [get]
func VtuberChannelStats(ctx fiber.Ctx) error {
	handle := ctx.Params("handle")
	days, _ := strconv.Atoi(ctx.Query("days"))
	stats, err := vtuberService.ListChannelStats(handle, days)
	if err != nil {
		return requestError(err)
	}
	if stats == nil {
		return output.NotFound(fmt.Errorf("channel %s not found", handle))
	}
	return output.Success(stats)
}

// VtuberChannelVideos lists a channel's uploads, including live archives.
// @Summary List VTuber channel videos
// @Tags OpenData VTuber
// @Produce json
// @Param handle path string true "YouTube @handle"
// @Param type query string false "all (default) / live / video / short"
// @Param page_token query string false "Token of the next page"
// @Success 200 {object} output.CommonOutput
// @Failure 400 {object} output.CommonOutput
// @Failure 404 {object} output.CommonOutput
// @Failure 502 {object} output.CommonOutput
// @Router /opendata/vtubers/channels/{handle}/videos [get]
func VtuberChannelVideos(ctx fiber.Ctx) error {
	handle := ctx.Params("handle")
	page, err := vtuberService.ListChannelVideos(ctx.Context(), handle, ctx.Query("type"), ctx.Query("page_token"))
	if errors.Is(err, vtuberService.ErrInvalidRequest) {
		return output.BadRequest(err)
	}
	if err != nil {
		return output.ExternalServiceError(err)
	}
	if page == nil {
		return output.NotFound(fmt.Errorf("channel %s not found", handle))
	}
	return output.Success(page)
}

// VtuberLives lists live streams within a time range.
// @Summary List VTuber live streams
// @Tags OpenData VTuber
// @Produce json
// @Param channel_id query string false "YouTube channel ID"
// @Param status query string false "upcoming / live / ended / cancelled"
// @Param from query string false "RFC 3339 or YYYY-MM-DD, default 1 day ago"
// @Param to query string false "RFC 3339 or YYYY-MM-DD, default 14 days after from + 1 day; range at most 31 days"
// @Success 200 {object} output.CommonOutput
// @Failure 400 {object} output.CommonOutput
// @Router /opendata/vtubers/lives [get]
func VtuberLives(ctx fiber.Ctx) error {
	var req vtuberEntity.LiveRequest
	if err := helper.BindQuery(ctx, &req); err != nil {
		return err
	}
	result, err := vtuberService.QueryLives(req)
	if err != nil {
		return requestError(err)
	}
	return output.Success(result)
}

// requestError 參數錯誤回 400，其餘當成 DB 錯誤
func requestError(err error) error {
	if errors.Is(err, vtuberService.ErrInvalidRequest) {
		return output.BadRequest(err)
	}
	return output.DBError(err)
}
