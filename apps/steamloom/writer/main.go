package main

import (
	"context"
	"embed"
	"log"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

// release workflow 會用 ldflags 寫入 tag 版號；本機開發版不執行自動更新檢查。
var version = "dev"

func main() {
	app := NewApp()
	// macOS：Edit 選單不要出現系統的「開始聽寫」「表情與符號」（其他平台不做事）
	prepareNativeMenu()
	err := wails.Run(&options.App{
		Title:     "SteamLoom Writer",
		Width:     1280,
		Height:    820,
		MinWidth:  1024,
		MinHeight: 680,
		Menu:      applicationMenu(app),
		AssetServer: &assetserver.Options{
			Assets: assets,
			// 圖像作品選好、還沒上傳的本機圖預覽（/local-image/<token>）
			Middleware: app.localImageMiddleware,
		},
		// 跟 nocturne 主題的底色一致，避免視窗開啟時閃白
		BackgroundColour: &options.RGBA{R: 16, G: 11, B: 24, A: 1},
		OnStartup:        app.startup,
		// 主選單建好、畫面載入後再整理 macOS 的 Edit 選單（拿掉 Wails 附帶的 Speech）；重新整理時重跑也不會重複刪
		OnDomReady:    func(context.Context) { trimNativeMenu() },
		OnShutdown:    app.shutdown,
		OnBeforeClose: app.beforeClose,
		Bind:          []any{app},
	})
	if err != nil {
		log.Fatal(err)
	}
}
