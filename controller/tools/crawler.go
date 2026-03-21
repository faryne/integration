package tools

import (
	"faryne.dev/model/entity/tools"
	"faryne.dev/service/crawler"
	"faryne.dev/service/output"
	"github.com/gofiber/fiber/v3"
)

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
