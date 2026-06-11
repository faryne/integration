package route

import (
	"faryne.dev/controller/auth"
	"github.com/gofiber/fiber/v3"
)

func Auth(app *fiber.App) {
	g := app.Group("/auth")
	g.Post("/session", auth.CreateSession)
	g.Delete("/session", auth.DestroySession)
}
