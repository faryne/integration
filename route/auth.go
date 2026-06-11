package route

import (
	"faryne.dev/controller/auth"
	"faryne.dev/middleware/encrypted"
	"github.com/gofiber/fiber/v3"
)

func Auth(app *fiber.App) {
	g := app.Group("/auth")
	g.Post("/session", auth.CreateSession)
	g.Delete("/session", auth.DestroySession)

	encryptedGroup := g.Group("/encrypted", encrypted.New())
	encryptedGroup.Get("/demo", auth.EncryptedDemo)
	encryptedGroup.Post("/demo", auth.EncryptedDemo)
	encryptedGroup.Put("/demo", auth.EncryptedDemo)
	encryptedGroup.Delete("/demo", auth.EncryptedDemo)
}
