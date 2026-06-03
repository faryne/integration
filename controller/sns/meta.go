package sns

import (
	modelSNS "faryne.dev/model/entity/sns"
	serviceSNS "faryne.dev/service/sns"
	"github.com/gofiber/fiber/v3"
)

func Render(ctx fiber.Ctx) error {
	html, err := serviceSNS.RenderHTML(modelSNS.RenderRequest{
		Path:  ctx.Params("*"),
		Query: string(ctx.Request().URI().QueryString()),
	})
	if err != nil {
		return err
	}

	ctx.Set(fiber.HeaderContentType, fiber.MIMETextHTMLCharsetUTF8)
	ctx.Set(fiber.HeaderCacheControl, "public, max-age=300")
	return ctx.SendString(html)
}
