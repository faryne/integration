package httpcache

import (
	"errors"
	"net/http/httptest"
	"testing"
	"time"

	"faryne.dev/service/output"

	"github.com/gofiber/fiber/v3"
)

// 跟 main.go 一樣由 ErrorHandler 把 output.New 寫成回應：200 才有 Cache-Control，404／500 沒有
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

	for path, want := range map[string]string{"/ok": "public, max-age=60, s-maxage=600", "/missing": ""} {
		res, err := app.Test(httptest.NewRequest("GET", path, nil))
		if err != nil {
			t.Fatal(err)
		}
		if got := res.Header.Get("Cache-Control"); got != want {
			t.Fatalf("%s: Cache-Control %q, want %q", path, got, want)
		}
	}
}
