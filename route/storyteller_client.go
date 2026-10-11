package route

import (
	"faryne.dev/controller/storytellerclient"
	"faryne.dev/middleware/storytellerbearer"
	"github.com/gofiber/fiber/v3"
)

// StorytellerClient 是原生 app（SteamLoom Writer）用的 REST API，以 Bearer token 認證。
// 跟 StorytellerMCP 一樣用 "-" 隔開前綴，避開 route.Storyteller 掛在 /storyteller 底下的 session middleware；
// steamloom.works 的同源 /api 會轉到這裡，對外網址是 https://steamloom.works/api/storyteller-client/...。
func StorytellerClient(app *fiber.App) {
	group := app.Group("/storyteller-client", storytellerbearer.New())
	group.Get("/me", storytellerclient.Me)
	group.Get("/projects", storytellerclient.Projects)
}
