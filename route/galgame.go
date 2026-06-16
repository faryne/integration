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
	group.Post("/brands/submissions", galgame.SubmitBrands)

	authenticated := group.Group("", authsession.New())
	authenticated.Post("/favorites/status", galgame.FavoriteStatus)
	authenticated.Get("/favorites/brands", galgame.FavoriteBrands)
	authenticated.Get("/favorites/videos", galgame.FavoriteVideos)
	authenticated.Get("/admin/brands", galgame.AdminBrands)
	authenticated.Put("/admin/brands/:brandId/status", galgame.SetBrandStatus)
	authenticated.Get("/brands/:brand/favorite", galgame.BrandFavorite)
	authenticated.Put("/brands/:brand/favorite", galgame.SetBrandFavorite)
	authenticated.Get("/:brand/video/:videoId/favorite", galgame.VideoFavorite)
	authenticated.Put("/:brand/video/:videoId/favorite", galgame.SetVideoFavorite)
	authenticated.Get("/:brand/video/:videoId/reaction", galgame.VideoReaction)
	authenticated.Put("/:brand/video/:videoId/reaction", galgame.SetVideoReaction)
}
