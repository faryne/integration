package route

import (
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

	// 版權申告：必須註冊在 /:site/:authorId 之前，否則 GET 會被當成搜尋路徑吃掉
	g.Post("/forbidden-submissions", nekomaid.SubmitForbidden)
	g.Get("/forbidden-submissions/:token", nekomaid.ForbiddenSubmissionStatus)

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
