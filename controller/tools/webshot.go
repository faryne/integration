package tools

import (
	"strings"

	"github.com/gofiber/fiber/v3"

	"faryne.dev/controller/helper"
	"faryne.dev/model/entity"
	modelTools "faryne.dev/model/entity/tools"
	"faryne.dev/service/output"
	"faryne.dev/service/screenshot"
)

// WebshotCreate creates a screenshot for a URL.
// @Summary Create webshot
// @Tags Tools
// @Accept json
// @Produce json
// @Param request body tools.WebshotRequest true "Webshot request"
// @Success 200 {object} output.CommonOutput
// @Failure 400 {object} output.CommonOutput
// @Failure 500 {object} output.CommonOutput
// @Router /tools/webshot [post]
func WebshotCreate(ctx fiber.Ctx) error {
	var req modelTools.WebshotRequest
	if err := helper.BindJSON(ctx, &req); err != nil {
		return err
	}

	req.Url = strings.TrimSpace(req.Url)
	resp, err := screenshot.Screenshot(req.Url)
	if err != nil {
		return output.InternalServiceError(err)
	}
	return output.Success(resp)
}

// WebshotGet returns screenshot history for a URL hash.
// @Summary Get webshot history
// @Tags Tools
// @Produce json
// @Param hash path string true "URL hash"
// @Param page query int false "Page number"
// @Param per_page query int false "Rows per page"
// @Success 200 {object} output.CommonOutput
// @Failure 400 {object} output.CommonOutput
// @Failure 404 {object} output.CommonOutput
// @Failure 500 {object} output.CommonOutput
// @Router /tools/webshot/{hash} [get]
func WebshotGet(ctx fiber.Ctx) error {
	var uriReq modelTools.WebshotGetURIRequest
	if err := helper.BindParams(ctx, &uriReq); err != nil {
		return err
	}

	var queryReq entity.CommonPaginationQueryRequest
	if err := helper.BindQuery(ctx, &queryReq); err != nil {
		return err
	}

	resp, err := screenshot.GetHistory(strings.TrimSpace(uriReq.Hash), queryReq.PageValue(), queryReq.PerPageValue(10))
	if err != nil {
		if screenshot.IsWebshotNotFound(err) {
			return output.NotFound(err)
		}
		return output.InternalServiceError(err)
	}
	return output.Success(resp)
}
