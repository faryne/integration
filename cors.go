package main

import (
	"net/url"
	"slices"
	"strings"

	"faryne.dev/config"
	"github.com/gofiber/fiber/v3"
	"github.com/gofiber/fiber/v3/middleware/cors"
)

// corsExposeHeaders 讓前端讀得到 session 到期時間（跨站時瀏覽器預設不給讀自訂 header）
var corsExposeHeaders = []string{"X-Session-Expires-At"}

// corsMiddleware 分兩組 CORS：
//   - 公開協定端點（MCP、OAuth、.well-known）維持 *：靠 bearer token／PAT 驗證，瀏覽器版 MCP client 要能跨站呼叫。
//   - 其他 API 只放行白名單（config.CORSOrigins），非 production 另外放行任何 port 的 localhost／127.0.0.1。
//
// 路徑是 nginx 剝掉 /api、/api-integration 前綴後的後端路徑；steamloom.works 的 /mcp 會被改寫成 /storyteller-mcp，joyu.fyi 的改寫成 /joyu-mcp。
func corsMiddleware() fiber.Handler {
	public := cors.New(cors.Config{ExposeHeaders: corsExposeHeaders})
	site := cors.New(siteCORSConfig())
	return func(c fiber.Ctx) error {
		if isPublicProtocolPath(c.Path()) {
			return public(c)
		}
		return site(c)
	}
}

func siteCORSConfig() cors.Config {
	origins := config.EnvConfig().CORSOrigins()
	if slices.Contains(origins, "*") {
		return cors.Config{ExposeHeaders: corsExposeHeaders}
	}
	isDev := !config.EnvConfig().IsProduction()
	// 只用 AllowOriginsFunc（跟 AllowOrigins 並用 Fiber 會噴警告）；Fiber 傳進來的是原始 Origin，自己轉小寫比對
	return cors.Config{
		ExposeHeaders: corsExposeHeaders,
		AllowOriginsFunc: func(origin string) bool {
			origin = strings.ToLower(origin)
			return slices.Contains(origins, origin) || (isDev && isLocalOrigin(origin))
		},
	}
}

// isPublicProtocolPath 判斷是否為維持 * 的公開協定端點
func isPublicProtocolPath(path string) bool {
	return path == "/mcp" || path == "/storyteller-mcp" || path == "/joyu-mcp" ||
		strings.HasPrefix(path, "/storyteller-mcp/") ||
		strings.HasPrefix(path, "/oauth/") ||
		strings.HasPrefix(path, "/.well-known/")
}

// isLocalOrigin 判斷是否為本機開發的 origin（任何 port），本機 vite 換 port 不用改設定；
// *.localhost 是本機測獨立站模式用的（例如 joyu.localhost，見前端 helpers/joyu.ts）
func isLocalOrigin(origin string) bool {
	u, err := url.Parse(origin)
	if err != nil || u.Scheme != "http" {
		return false
	}
	host := u.Hostname()
	return host == "localhost" || host == "127.0.0.1" || strings.HasSuffix(host, ".localhost")
}
