package route

import (
	"faryne.dev/controller/storytelleroauth"
	"github.com/gofiber/fiber/v3"
)

// StorytellerOAuth 註冊 OAuth authorization server 的公開端點（給 OAuth client 呼叫）；
// 授權頁與 grant 管理這類需要 session 的 API 掛在 route.Storyteller 的 authenticated 群組。
// steamloom.works 的 nginx 要把這些路徑轉給後端，/oauth/authorize 則留給前端 SPA。
func StorytellerOAuth(app *fiber.App) {
	app.Get("/.well-known/oauth-protected-resource", storytelleroauth.ProtectedResourceMetadata)
	// RFC 9728 允許 client 依 resource 路徑查 /.well-known/oauth-protected-resource/mcp
	app.Get("/.well-known/oauth-protected-resource/*", storytelleroauth.ProtectedResourceMetadata)
	app.Get("/.well-known/oauth-authorization-server", storytelleroauth.AuthorizationServerMetadata)
	app.Post("/oauth/register", storytelleroauth.Register)
	app.Post("/oauth/token", storytelleroauth.Token)
	app.Post("/oauth/revoke", storytelleroauth.Revoke)
}
