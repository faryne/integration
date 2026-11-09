package route

import (
	"faryne.dev/controller/joyu"
	"faryne.dev/middleware/httpcache"
	"faryne.dev/middleware/joyuauth"

	"github.com/gofiber/fiber/v3"
)

// Joyu joyu.fyi 登入後的個人 API：帶 joyu-firebase 的 ID token（不用 session），回應一律 no-store
func Joyu(app *fiber.App) {
	g := app.Group("/joyu/me", httpcache.NoStoreByDefault(), joyuauth.New())
	g.Get("/follows", joyu.Follows)
	g.Put("/follows", joyu.Follow)
	g.Delete("/follows", joyu.Unfollow)
	g.Get("/feed", joyu.Feed)
	// 片單：想看／看過＋評分
	g.Get("/marks", joyu.Marks)
	g.Get("/marks/videos", joyu.MarkedVideos)
	g.Put("/marks/:no", joyu.SetMark)
	g.Delete("/marks/:no", joyu.RemoveMark)
	g.Post("/merge", joyu.Merge)
	g.Delete("", joyu.DeleteAccount)
}
