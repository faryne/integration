package main

import (
	"runtime"

	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

const aboutEvent = "app:show-about"

// applicationMenu 只留必要的選單：macOS 的 App 選單（系統必備、⌘Q 在這）與 Edit（WebView 的 ⌘C／⌘V／⌘Z 靠它運作），
// 三平台都有「說明 → 關於」。Edit 只保留到「全選」，之後的 Speech、Writing Tools、AutoFill 等由 menu_native_darwin.go 移除。
func applicationMenu(app *App) *menu.Menu {
	result := menu.NewMenu()
	if runtime.GOOS == "darwin" {
		result.Append(menu.AppMenu())
		result.Append(menu.EditMenu())
	}
	help := result.AddSubmenu("說明")
	help.AddText("關於 SteamLoom Writer", keys.CmdOrCtrl(","), func(_ *menu.CallbackData) {
		wailsruntime.EventsEmit(app.ctx, aboutEvent)
	})
	return result
}
