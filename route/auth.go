package route

import (
	"faryne.dev/config"
	"faryne.dev/controller/auth"
	"faryne.dev/middleware/authsession"
	"faryne.dev/middleware/encrypted"
	"github.com/gofiber/fiber/v3"
)

func Auth(app *fiber.App) {
	g := app.Group("/auth")
	g.Get("/session", authsession.New(), auth.GetSession)
	g.Post("/session", auth.CreateSession)
	g.Delete("/session", auth.DestroySession)

	// 只在本機明確開 `ENABLE_DEV_AUTH_BYPASS=true` 時才註冊這條路由——staging／
	// 正式環境的環境變數不會設這個值，這個端點在那些環境完全不存在（連 404 都不是
	// 「存在但被擋」，是路由表裡根本沒有這一條），不是只靠 handler 內部判斷。
	if config.EnvConfig().EnableDevAuthBypass {
		g.Post("/dev-session", auth.CreateDevSession)
	}

	encryptedGroup := g.Group("/encrypted", encrypted.New())
	encryptedGroup.Get("/demo", auth.EncryptedDemo)
	encryptedGroup.Post("/demo", auth.EncryptedDemo)
	encryptedGroup.Put("/demo", auth.EncryptedDemo)
	encryptedGroup.Delete("/demo", auth.EncryptedDemo)
}
