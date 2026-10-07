package route

import (
	"faryne.dev/controller/sns"
	"github.com/gofiber/fiber/v3"
)

func SNS(app *fiber.App) {
	g := app.Group("/sns")
	g.Get("", sns.Render)
	g.Get("/*", sns.Render)
	// SteamLoom 預覽圖卡：nginx 把 steamloom.works/og-image/* 轉成 /sns-image/storyteller/*
	app.Get("/sns-image/*", sns.OGImage)
	// steamloom.works 的 robots.txt／sitemap.xml（主站的放在前端 public/）
	app.Get("/sns-seo/steamloom/robots.txt", sns.SteamLoomRobots)
	app.Get("/sns-seo/steamloom/sitemap.xml", sns.SteamLoomSitemap)
}
