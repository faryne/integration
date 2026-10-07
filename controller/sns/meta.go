package sns

import (
	modelSNS "faryne.dev/model/entity/sns"
	"faryne.dev/service/output"
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
	html, status, err := serviceSNS.RenderHTML(modelSNS.RenderRequest{
		Path:  ctx.Params("*"),
		Query: string(ctx.Request().URI().QueryString()),
		Host:  ctx.Get("X-Forwarded-Host"),
	})
	if err != nil {
		return err
	}

	ctx.Set(fiber.HeaderContentType, fiber.MIMETextHTMLCharsetUTF8)
	ctx.Set(fiber.HeaderCacheControl, "public, max-age=300")
	// 私人／不存在的內容回 404：平台不產生預覽卡，搜尋引擎也會移出索引
	return ctx.Status(status).SendString(html)
}

// OGImage renders the SteamLoom share card image (1200x630 JPEG).
// @Summary Render SteamLoom share card image
// @Tags SNS
// @Produce jpeg
// @Param path path string true "Reader path, e.g. storyteller/work/{project}/story/{id}.jpg"
// @Success 200 {file} binary
// @Failure 302 {string} string "Redirect to the brand default image"
// @Failure 404 {string} string "Not visible to readers"
// @Router /sns-image/{path} [get]
func OGImage(ctx fiber.Ctx) error {
	result := serviceSNS.StorytellerOGImage(ctx.Params("*"))
	switch result.Status {
	case fiber.StatusOK:
		ctx.Set(fiber.HeaderContentType, "image/jpeg")
		ctx.Set(fiber.HeaderCacheControl, "public, max-age=86400")
		return ctx.Send(result.Body)
	case fiber.StatusFound:
		// 預設圖是暫時的（作者之後可能補封面），不能給 301 讓平台永久記住
		ctx.Set(fiber.HeaderCacheControl, "public, max-age=300")
		return ctx.Redirect().Status(fiber.StatusFound).To(result.RedirectURL)
	default:
		ctx.Set(fiber.HeaderCacheControl, "public, max-age=300")
		return ctx.SendStatus(fiber.StatusNotFound)
	}
}

// SteamLoomRobots renders robots.txt for steamloom.works.
// @Summary SteamLoom robots.txt
// @Tags SNS
// @Produce plain
// @Success 200 {string} string "robots.txt"
// @Router /sns-seo/steamloom/robots.txt [get]
func SteamLoomRobots(ctx fiber.Ctx) error {
	ctx.Set(fiber.HeaderContentType, fiber.MIMETextPlainCharsetUTF8)
	ctx.Set(fiber.HeaderCacheControl, "public, max-age=3600")
	return ctx.SendString(serviceSNS.SteamLoomRobotsTxt())
}

// SteamLoomSitemap renders sitemap.xml for steamloom.works.
// @Summary SteamLoom sitemap.xml
// @Tags SNS
// @Produce xml
// @Success 200 {string} string "sitemap.xml"
// @Router /sns-seo/steamloom/sitemap.xml [get]
func SteamLoomSitemap(ctx fiber.Ctx) error {
	body, err := serviceSNS.SteamLoomSitemapXML()
	if err != nil {
		return output.DBError(err)
	}
	ctx.Set(fiber.HeaderContentType, fiber.MIMEApplicationXMLCharsetUTF8)
	ctx.Set(fiber.HeaderCacheControl, "public, max-age=3600")
	return ctx.SendString(body)
}
