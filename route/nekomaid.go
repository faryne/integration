package route

import (
	"faryne.dev/controller/nekomaid"
	"github.com/gofiber/fiber/v3"
)

func Nekomaid(app *fiber.App) {
	g1 := app.Group("/yandere")
	g1.Get("/tags", nekomaid.YandereTags)

	g := app.Group("/nekomaid")
	g.Get("/search.rss/:site?/:authorId?/:artworkId?", nekomaid.SearchRSS)
	g.Get("/search/:site?/:authorId?/:artworkId?", nekomaid.Search)
	g.Post("/retrieve.json", nekomaid.Retrieve)
	g.Get("/retrieve.json", nekomaid.Retrieve)
}
