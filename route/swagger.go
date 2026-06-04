package route

import (
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/swagger/v2"

	_ "faryne.dev/docs"
)

func Swagger(app *fiber.App) {
	app.Get("/swagger/*", swagger.HandlerDefault)
}
