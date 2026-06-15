package route

import (
	"faryne.dev/controller/galgame"
	"faryne.dev/middleware/authsession"
	"github.com/gofiber/fiber/v3"
)

func Galgame(app *fiber.App) {
	group := app.Group("/galgame")
	group.Get("/brands", galgame.Brands)
	group.Get("/brands/:brand", galgame.Brand)
	group.Get("/video", galgame.Videos)
	group.Get("/:brand/video", galgame.Videos)
	group.Get("/:brand/video/:videoId/related", galgame.RelatedVideos)
	group.Get("/:brand/video/:videoId/navigation", galgame.VideoNavigation)
	group.Get("/:brand/video/:videoId", galgame.Video)

	authenticated := group.Group("", authsession.New())
	authenticated.Get("/brands/:brand/favorite", galgame.BrandFavorite)
	authenticated.Put("/brands/:brand/favorite", galgame.SetBrandFavorite)
	authenticated.Get("/:brand/video/:videoId/favorite", galgame.VideoFavorite)
	authenticated.Put("/:brand/video/:videoId/favorite", galgame.SetVideoFavorite)
}
