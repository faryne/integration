package route

import (
	"faryne.dev/controller/storytellermcp"
	"faryne.dev/middleware/storytellerbearer"
	"github.com/gofiber/fiber/v3"
)

// 故意不用 /storyteller/mcp：route.Storyteller 的 authenticated 群組是用
// group.Group("", session middleware) 掛 middleware，Fiber v3 底層會把這個
// 註冊成掛在 /storyteller 前綴、對所有 method 生效的 Use 路由，只要路徑前綴後
// 緊接著 "/" 就會命中（見 hasPartialMatchBoundary），/storyteller/mcp 會先被
// authsession 攔截、根本走不到這裡的 storytellerbearer 驗證。用 "-" 隔開前綴，
// 讓 boundary 判斷不成立，才能繞開那個 Use 路由。
//
// Skill 的公開下載也掛在這裡：steamloom.works 的 nginx 把整個 /mcp 前綴改寫成 /storyteller-mcp
// （httpd_conf/nginx 的 location /mcp），對外網址就是 https://steamloom.works/mcp/skill.md；
// faryne.dev 則走 /api-integration/storyteller-mcp/skill.md。steamloom.works 沒有 /api-integration，
// 那個前綴只會落到前端首頁。這幾條（SKILL.md、ZIP、兩支安裝程式）是 GET、不掛 storytellerbearer，不需要登入。
func StorytellerMCP(app *fiber.App) {
	app.Post("/storyteller-mcp", storytellerbearer.New(), storytellermcp.Handle)
	app.Get("/storyteller-mcp/skill.md", storytellermcp.SkillMarkdown)
	app.Get("/storyteller-mcp/skill.zip", storytellermcp.SkillZip)
	app.Get("/storyteller-mcp/skill-installer.sh", storytellermcp.SkillInstallerSh)
	app.Get("/storyteller-mcp/skill-installer.ps1", storytellermcp.SkillInstallerPs1)
}
