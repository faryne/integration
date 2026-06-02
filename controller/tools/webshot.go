package tools

import (
	"strings"

	"faryne.dev/model/entity"
	modelTools "faryne.dev/model/entity/tools"
	"faryne.dev/service/output"
	"faryne.dev/service/screenshot"

	"github.com/gofiber/fiber/v3"
)

func WebshotCreate(ctx fiber.Ctx) error {
	var req modelTools.WebshotRequest
	if err := ctx.Bind().Body(&req); err != nil {
		return output.BadRequest(err)
	}

	req.Url = strings.TrimSpace(req.Url)
	resp, err := screenshot.Screenshot(req.Url)
	if err != nil {
		return output.InternalServiceError(err)
	}
	return output.Success(resp)
}

func WebshotGet(ctx fiber.Ctx) error {
	var uriReq modelTools.WebshotGetURIRequest
	if err := ctx.Bind().URI(&uriReq); err != nil {
		return output.BadRequest(err)
	}

	var queryReq entity.CommonPaginationQueryRequest
	if err := ctx.Bind().Query(&queryReq); err != nil {
		return output.BadRequest(err)
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
