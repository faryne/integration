package httpcache

import (
	"errors"
	"fmt"
	"net/http"
	"time"

	"faryne.dev/service/output"

	"github.com/gofiber/fiber/v3"
)

// Public 讓公開、不分使用者的 GET API 可以被瀏覽器與 Cloudflare 快取：
// 只有 200 回應才加 Cache-Control（錯誤、查無資料不快取，避免暫時性錯誤被存在邊緣好幾分鐘）。
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
		ok := err == nil && c.Response().StatusCode() == http.StatusOK
		if out, isOutput := errors.AsType[output.CommonOutputInterface](err); isOutput {
			ok = out.HttpCode() == http.StatusOK
		}
		if ok {
			c.Set(fiber.HeaderCacheControl, value)
		}
		return err
	}
}
