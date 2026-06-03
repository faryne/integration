package route

import (
	"faryne.dev/controller/sns"
	"github.com/gofiber/fiber/v3"
)

func SNS(app *fiber.App) {
	g := app.Group("/sns")
	g.Get("", sns.Render)
	g.Get("/*", sns.Render)
}
