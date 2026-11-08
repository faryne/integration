package route

import (
	"faryne.dev/controller/mcp"
	"github.com/gofiber/fiber/v3"
)

func MCP(app *fiber.App) {
	app.Post("/mcp", mcp.Handle)
	// joyu.fyi 的 /mcp 由 nginx 改寫到這裡（同 steamloom.works 改寫成 /storyteller-mcp）
	app.Post("/joyu-mcp", mcp.HandleJoyu)
}
