package route

import (
	"faryne.dev/controller/storytellermcp"
	"faryne.dev/middleware/storytellerpat"
	"github.com/gofiber/fiber/v3"
)

// 故意不用 /storyteller/mcp：route.Storyteller 的 authenticated 群組是用
// group.Group("", authsession.New()) 掛 middleware，Fiber v3 底層會把這個
// 註冊成掛在 /storyteller 前綴、對所有 method 生效的 Use 路由，只要路徑前綴後
// 緊接著 "/" 就會命中（見 hasPartialMatchBoundary），/storyteller/mcp 會先被
// authsession 攔截、根本走不到這裡的 storytellerpat 驗證。用 "-" 隔開前綴，
// 讓 boundary 判斷不成立，才能繞開那個 Use 路由。
func StorytellerMCP(app *fiber.App) {
	app.Post("/storyteller-mcp", storytellerpat.New(), storytellermcp.Handle)
}
