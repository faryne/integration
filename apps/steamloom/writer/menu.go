package main

import (
	"runtime"

	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

const aboutEvent = "app:show-about"

// applicationMenu 保留 macOS 原生選單，三平台都在「說明」提供可操作的 About 視窗。
func applicationMenu(app *App) *menu.Menu {
	result := menu.NewMenu()
	if runtime.GOOS == "darwin" {
		result.Append(menu.AppMenu())
		result.Append(menu.EditMenu())
		result.Append(menu.WindowMenu())
	}
	help := result.AddSubmenu("說明")
	help.AddText("關於 SteamLoom Writer", keys.CmdOrCtrl(","), func(_ *menu.CallbackData) {
		wailsruntime.EventsEmit(app.ctx, aboutEvent)
	})
	return result
}
