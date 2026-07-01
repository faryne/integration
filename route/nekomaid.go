package route

import (
	"faryne.dev/controller/nekomaid"
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

	// 原本在 route/opendata.go 底下的 /opendata/nekomaid 搜尋與作品詳情路由，
	// 併入這裡並統一路徑為 /nekomaid/...。
	g.Get("", nekomaid.Search)
	g.Get("/:site", nekomaid.Search)
	g.Get("/:site/:authorId", nekomaid.Search)
	g.Get("/:site/:authorId/:artworkId", nekomaid.Artwork)
}
