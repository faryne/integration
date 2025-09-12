package route

import (
	"faryne.dev/controller/opendata"
	"github.com/gofiber/fiber/v3"
)

func OpenData(app *fiber.App) {
	g := app.Group("/opendata")

	g1 := g.Group("/rates")
	g1.Get("", opendata.Rate)
	g1.Get("/banks", opendata.Banks)

	g2 := g.Group("/ntpcfd")
	g2.Get("", opendata.FetchNtpcFDEvents)
	g2.Get("/units", opendata.FetchNtpcFDUnits)
}
