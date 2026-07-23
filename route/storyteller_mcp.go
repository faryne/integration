package route

import (
	"faryne.dev/controller/storytellermcp"
	"faryne.dev/middleware/storytellerpat"
	"github.com/gofiber/fiber/v3"
)

func StorytellerMCP(app *fiber.App) {
	app.Post("/storyteller/mcp", storytellerpat.New(), storytellermcp.Handle)
}
