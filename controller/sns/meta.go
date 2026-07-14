package sns

import (
	modelSNS "faryne.dev/model/entity/sns"
	serviceSNS "faryne.dev/service/sns"
	"github.com/gofiber/fiber/v3"
)

// Render renders SNS metadata HTML.
// @Summary Render SNS metadata HTML
// @Tags SNS
// @Produce html
// @Param path path string false "SNS path"
// @Success 200 {string} string "HTML"
// @Router /sns [get]
// @Router /sns/{path} [get]
func Render(ctx fiber.Ctx) error {
	html, err := serviceSNS.RenderHTML(modelSNS.RenderRequest{
		Path:  ctx.Params("*"),
		Query: string(ctx.Request().URI().QueryString()),
		Host:  ctx.Get("X-Forwarded-Host"),
	})
	if err != nil {
		return err
	}

	ctx.Set(fiber.HeaderContentType, fiber.MIMETextHTMLCharsetUTF8)
	ctx.Set(fiber.HeaderCacheControl, "public, max-age=300")
	return ctx.SendString(html)
}
