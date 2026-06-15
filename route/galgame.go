package route

import (
	"faryne.dev/controller/galgame"
	"github.com/gofiber/fiber/v3"
)

func Galgame(app *fiber.App) {
	group := app.Group("/galgame")
	group.Get("/brands", galgame.Brands)
	group.Get("/brands/:brand", galgame.Brand)
	group.Get("/video", galgame.Videos)
	group.Get("/:brand/video", galgame.Videos)
	group.Get("/:brand/video/:videoId", galgame.Video)
}
