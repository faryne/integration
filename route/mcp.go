package route

import (
	"faryne.dev/controller/mcp"
	"github.com/gofiber/fiber/v3"
)

func MCP(app *fiber.App) {
	app.Post("/mcp", mcp.Handle)
}
