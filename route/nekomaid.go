package route

import (
	"faryne.dev/config"
	"faryne.dev/controller/auth"
	"faryne.dev/controller/nekomaid"
	"faryne.dev/middleware/authsession"
	authService "faryne.dev/service/auth"
	"github.com/gofiber/fiber/v3"
)

func Nekomaid(app *fiber.App) {
	g1 := app.Group("/yandere")
	g1.Get("/tags", nekomaid.YandereTags)

	g := app.Group("/nekomaid")
	// search.rss、retrieve.json 這兩條路徑被 neko.maid.tw 網域的 nginx rewrite
	// 規則直接轉發過來，路徑不可更動。
	g.Get("/search.rss/:site?/:authorId?/:artworkId?", nekomaid.SearchRSS)
	g.Post("/retrieve.json", nekomaid.Retrieve)
	g.Get("/retrieve.json", nekomaid.Retrieve)

	// 帳號（neko 專用 brand）與我的追蹤：同樣要註冊在 /:site 系列之前
	g.Post("/auth/login", nekomaid.AccountLogin)
	g.Post("/auth/register", nekomaid.AccountRegister)
	g.Post("/auth/password-reset", nekomaid.AccountPasswordReset)
	g.Post("/auth/action", nekomaid.AccountAction)
	g.Get("/auth/session", authsession.New(authService.BrandNekomaid), nekomaid.AccountCurrent)
	g.Put("/auth/email", authsession.New(authService.BrandNekomaid), nekomaid.AccountChangeEmail)
	g.Delete("/auth/session", authsession.Optional(authService.BrandNekomaid), auth.DestroySessionBestEffort)
	if config.EnvConfig().EnableDevAuthBypass {
		g.Post("/auth/dev-session", nekomaid.AccountDevSession)
	}
	me := g.Group("/me", authsession.New(authService.BrandNekomaid))
	me.Get("/favorites/keys", nekomaid.FavoriteKeys)
	me.Get("/favorites/authors", nekomaid.FavoriteAuthors)
	me.Get("/favorites/artworks", nekomaid.FavoriteArtworks)
	me.Get("/favorites/tags", nekomaid.FavoriteTags)
	me.Put("/favorites/tags", nekomaid.FollowTag)
	me.Delete("/favorites/tags", nekomaid.UnfollowTag)
	me.Put("/favorites/authors/:site/:authorId", nekomaid.FollowAuthor)
	me.Delete("/favorites/authors/:site/:authorId", nekomaid.UnfollowAuthor)
	me.Put("/favorites/artworks/:site/:authorId/:artworkId", nekomaid.FavoriteArtwork)
	me.Delete("/favorites/artworks/:site/:authorId/:artworkId", nekomaid.UnfavoriteArtwork)

	// 版權申告：必須註冊在 /:site、/:site/:authorId 之前，否則 GET 會被當成搜尋路徑吃掉
	g.Post("/forbidden-submissions", nekomaid.SubmitForbidden)
	g.Get("/forbidden-submissions", nekomaid.PublicForbiddenSubmissions)
	g.Get("/forbidden-submissions/:hash", nekomaid.ForbiddenSubmissionsByHash)

	// 原本在 route/opendata.go 底下的 /opendata/nekomaid 搜尋與作品詳情路由，
	// 併入這裡並統一路徑為 /nekomaid/...。
	g.Get("", nekomaid.Search)
	g.Get("/:site", nekomaid.Search)
	g.Get("/:site/:authorId", nekomaid.Search)
	g.Get("/:site/:authorId/:artworkId", nekomaid.Artwork)

	// 管理 API：前端在 faryne.dev/backend_admin/nekomaid/*；service 層再以 users.is_admin（RequireAdmin）判斷
	admin := app.Group("/admin/nekomaid", authsession.New(authService.BrandMain))
	admin.Get("/forbidden", nekomaid.AdminForbiddenList)
	admin.Post("/forbidden", nekomaid.AdminCreateForbidden)
	admin.Delete("/forbidden/:id", nekomaid.AdminDeleteForbidden)
	admin.Get("/forbidden-submissions", nekomaid.AdminForbiddenSubmissions)
	admin.Put("/forbidden-submissions/:id/approve", nekomaid.AdminApproveForbiddenSubmission)
	admin.Put("/forbidden-submissions/:id/reject", nekomaid.AdminRejectForbiddenSubmission)
}
