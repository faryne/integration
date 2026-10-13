package main

import (
	"embed"
	"log"
	"os"

	"faryne.dev/apps/steamloom/writer/internal/agent"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:frontend/dist
var assets embed.FS

// release workflow 會用 ldflags 寫入 tag 版號；本機開發版不執行自動更新檢查。
var version = "dev"

func main() {
	if len(os.Args) > 1 && os.Args[1] == "--asset-mcp" {
		if len(os.Args) != 7 {
			log.Fatal("圖片 MCP grant 參數不正確")
		}
		if err := agent.ServeAssetMCP(os.Stdin, os.Stdout, os.Args[2], os.Args[3], os.Args[4], os.Args[5], os.Args[6]); err != nil {
			log.Fatal(err)
		}
		return
	}
	app := NewApp()
	err := wails.Run(&options.App{
		Title:     "SteamLoom Writer",
		Width:     1280,
		Height:    820,
		MinWidth:  1024,
		MinHeight: 680,
		Menu:      applicationMenu(app),
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		// 跟 nocturne 主題的底色一致，避免視窗開啟時閃白
		BackgroundColour: &options.RGBA{R: 16, G: 11, B: 24, A: 1},
		OnStartup:        app.startup,
		OnShutdown:       app.shutdown,
		Bind:             []any{app},
	})
	if err != nil {
		log.Fatal(err)
	}
}
