package main

import (
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
	err := wails.Run(&options.App{
		Title:     "SteamLoom Writer",
		Width:     1280,
		Height:    820,
		MinWidth:  1024,
		MinHeight: 680,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		// 跟 nocturne 主題的底色一致，避免視窗開啟時閃白
		BackgroundColour: &options.RGBA{R: 16, G: 11, B: 24, A: 1},
		OnStartup:        app.startup,
		Bind:             []any{app},
	})
	if err != nil {
		log.Fatal(err)
	}
}
