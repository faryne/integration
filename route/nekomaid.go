package route

import (
	"faryne.dev/controller/nekomaid"
	"github.com/gofiber/fiber/v3"
)

func Nekomaid(app *fiber.App) {
	g1 := app.Group("/yandere")
	g1.Get("/tags", nekomaid.YandereTags)

	g := app.Group("/nekomaid")
	g.Post("/retrieve.json", nekomaid.Retrieve)
}
