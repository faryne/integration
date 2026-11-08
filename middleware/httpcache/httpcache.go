package httpcache

import (
	"errors"
	"fmt"
	"net/http"
	"time"

	"faryne.dev/service/output"

	"github.com/gofiber/fiber/v3"
)

// noStore 不能被任何一層（瀏覽器、Cloudflare）快取
const noStore = "no-store"

// Public 讓公開、不分使用者的 GET API 可以被瀏覽器與 Cloudflare 快取：只有 200 回應才標成 public，
// 其他（錯誤、查無資料）明確標 no-store，避免 Cloudflare 套預設 TTL 把 404 也快取起來。
// maxAge 是瀏覽器端、sMaxAge 是 CDN（Cloudflare 要另外設 Cache Rule 讓 /api 的 JSON 走快取才會生效）。
// 注意：這個專案連成功回應都是 handler 以 error（output.CommonOutputInterface）回傳、再由 main.go 的
// ErrorHandler 寫出去，所以要看回傳值裡的 HTTP code 判斷成功，不能只看 err == nil
func Public(maxAge, sMaxAge time.Duration) fiber.Handler {
	value := fmt.Sprintf("public, max-age=%d, s-maxage=%d", int(maxAge.Seconds()), int(sMaxAge.Seconds()))
	return func(c fiber.Ctx) error {
		err := c.Next()
		if c.Method() != http.MethodGet {
			return err
		}
		if responseCode(c, err) == http.StatusOK {
			c.Set(fiber.HeaderCacheControl, value)
		} else {
			c.Set(fiber.HeaderCacheControl, noStore)
		}
		return err
	}
}

// NoStoreByDefault 掛在整個路由群組：裡面的路由沒有自己標 Cache-Control（沒用 Public）的回應一律 no-store。
// Cloudflare 的 Cache Rule 是依路徑前綴設的，像上稿審核狀態這種會變動的 API 也在同一個前綴底下，
// 不能讓它們被套用預設 TTL 快取
func NoStoreByDefault() fiber.Handler {
	return func(c fiber.Ctx) error {
		err := c.Next()
		if len(c.Response().Header.Peek(fiber.HeaderCacheControl)) == 0 {
			c.Set(fiber.HeaderCacheControl, noStore)
		}
		return err
	}
}

// responseCode 實際要回的 HTTP code：handler 回傳 output.CommonOutputInterface 時看它的 code，否則看目前的狀態碼
func responseCode(c fiber.Ctx, err error) int {
	if out, ok := errors.AsType[output.CommonOutputInterface](err); ok {
		return out.HttpCode()
	}
	if err != nil {
		return http.StatusInternalServerError
	}
	return c.Response().StatusCode()
}
