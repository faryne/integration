package route

import (
	"faryne.dev/controller/joyu"
	"faryne.dev/middleware/authsession"
	"faryne.dev/middleware/httpcache"
	"faryne.dev/middleware/joyuauth"
	authService "faryne.dev/service/auth"

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
	// 討論版：送出留言、檢舉；個人資料（暱稱）
	g.Post("/comments", joyu.PostComment)
	g.Post("/comments/:id/report", joyu.ReportComment)
	g.Get("/profile", joyu.Profile)
	g.Put("/profile", joyu.SetProfile)
	g.Post("/merge", joyu.Merge)
	g.Delete("", joyu.DeleteAccount)

	// 討論版的後台管理：主站登入且 users.is_admin（service 裡檢查）
	admin := app.Group("/admin/joyu", httpcache.NoStoreByDefault(), authsession.New(authService.BrandMain))
	admin.Get("/comments", joyu.AdminComments)
	admin.Delete("/comments/:id", joyu.AdminDeleteComment)
	admin.Get("/bans", joyu.AdminBans)
	admin.Post("/bans", joyu.AdminBan)
	admin.Delete("/bans/:id", joyu.AdminLiftBan)
}
