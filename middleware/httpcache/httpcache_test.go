package httpcache

import (
	"errors"
	"net/http/httptest"
	"testing"
	"time"

	"faryne.dev/service/output"

	"github.com/gofiber/fiber/v3"
)

// 跟 main.go 一樣由 ErrorHandler 把 output.New 寫成回應：200 是 public，其他是 no-store
func TestPublicOnlyCachesSuccess(t *testing.T) {
	app := fiber.New(fiber.Config{ErrorHandler: func(c fiber.Ctx, err error) error {
		if v, ok := errors.AsType[output.CommonOutputInterface](err); ok {
			return c.Status(v.HttpCode()).JSON(v.Output(0, ""))
		}
		return c.SendStatus(500)
	}})
	mw := Public(time.Minute, 10*time.Minute)
	app.Get("/ok", mw, func(c fiber.Ctx) error { return output.Success("x") })
	app.Get("/missing", mw, func(c fiber.Ctx) error { return output.New(404, "", nil, "nope") })

	// 群組預設 no-store：沒掛 Public 的路由也不能被快取，掛了 Public 的不會被蓋掉
	g := app.Group("/g", NoStoreByDefault())
	g.Get("/plain", func(c fiber.Ctx) error { return output.Success("x") })
	g.Get("/cached", mw, func(c fiber.Ctx) error { return output.Success("x") })

	for path, want := range map[string]string{
		"/ok":       "public, max-age=60, s-maxage=600",
		"/missing":  "no-store",
		"/g/plain":  "no-store",
		"/g/cached": "public, max-age=60, s-maxage=600",
	} {
		res, err := app.Test(httptest.NewRequest("GET", path, nil))
		if err != nil {
			t.Fatal(err)
		}
		if got := res.Header.Get("Cache-Control"); got != want {
			t.Fatalf("%s: Cache-Control %q, want %q", path, got, want)
		}
	}
}
