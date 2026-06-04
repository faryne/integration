package tools

import (
	"faryne.dev/model/entity/tools"
	"faryne.dev/service/crawler"
	"faryne.dev/service/output"
	"github.com/gofiber/fiber/v3"
)

// CrawlerExec crawls a URL with selector rules.
// @Summary Execute crawler
// @Tags Tools
// @Accept json
// @Produce json
// @Param request body tools.CrawlRequest true "Crawler request"
// @Success 200 {object} output.CommonOutput
// @Failure 400 {object} output.CommonOutput
// @Failure 500 {object} output.CommonOutput
// @Router /tools/crawler/exec [post]
func CrawlerExec(ctx fiber.Ctx) error {
	var req tools.CrawlRequest
	if err := ctx.Bind().Body(&req); err != nil {
		return output.BadRequest(err)
	}
	// 取得內容
	resp, err := crawler.CrawlByUrl(req.Uri, req.Rules)
	if err != nil {
		return output.InternalServiceError(err)
	}
	return output.Success(resp)
}
