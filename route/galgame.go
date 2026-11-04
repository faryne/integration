package route

import (
	"faryne.dev/controller/galgame"
	"faryne.dev/middleware/authsession"
	authService "faryne.dev/service/auth"
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
	group.Post("/videos/submissions", galgame.SubmitVideos)

	authenticated := group.Group("", authsession.New(authService.BrandMain))
	authenticated.Post("/favorites/status", galgame.FavoriteStatus)
	authenticated.Get("/favorites/brands", galgame.FavoriteBrands)
	authenticated.Get("/favorites/videos", galgame.FavoriteVideos)
	authenticated.Get("/brands/:brand/favorite", galgame.BrandFavorite)
	authenticated.Put("/brands/:brand/favorite", galgame.SetBrandFavorite)
	authenticated.Get("/:brand/video/:videoId/favorite", galgame.VideoFavorite)
	authenticated.Put("/:brand/video/:videoId/favorite", galgame.SetVideoFavorite)
	authenticated.Get("/:brand/video/:videoId/reaction", galgame.VideoReaction)
	authenticated.Put("/:brand/video/:videoId/reaction", galgame.SetVideoReaction)

	// 管理 API：前端在 faryne.dev/backend_admin/galgame/*；service 層再以 users.is_admin（RequireAdmin）判斷
	admin := app.Group("/admin/galgame", authsession.New(authService.BrandMain))
	admin.Get("/brands", galgame.AdminBrands)
	admin.Put("/brands/:brandId/status", galgame.SetBrandStatus)
	admin.Delete("/brands/:brandId", galgame.DeleteBrand)
	admin.Put("/brands/:brandId/restore", galgame.RestoreBrand)
	admin.Put("/brands/:brandId/pause-indexing", galgame.PauseBrandIndexing)
	admin.Put("/brands/:brandId/resume-indexing", galgame.ResumeBrandIndexing)
	admin.Post("/brands/:brandId/sync-videos", galgame.SyncBrandVideosNow)
	admin.Get("/videos", galgame.AdminVideos)
	admin.Delete("/videos/:videoId", galgame.DeleteVideo)
	admin.Put("/videos/:videoId/restore", galgame.RestoreVideo)
	admin.Get("/video-submissions", galgame.AdminVideoSubmissions)
	admin.Put("/video-submissions/:submissionId/status", galgame.SetVideoSubmissionStatus)
	admin.Get("/video-title-keywords", galgame.AdminVideoTitleKeywords)
	admin.Post("/video-title-keywords", galgame.CreateVideoTitleKeyword)
	admin.Put("/video-title-keywords/:keywordId", galgame.UpdateVideoTitleKeyword)
	admin.Delete("/video-title-keywords/:keywordId", galgame.DeleteVideoTitleKeyword)
}
