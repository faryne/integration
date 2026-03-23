package route

import (
	"faryne.dev/controller/tools"
	"github.com/gofiber/fiber/v3"
)

func Tools(app *fiber.App) {
	g := app.Group("tools")

	g1 := g.Group("/crawler")
	g1.Post("/exec", tools.CrawlerExec)
}
