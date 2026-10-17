package main

import (
	"runtime"

	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	wailsruntime "github.com/wailsapp/wails/v2/pkg/runtime"
)

const (
	aboutEvent    = "app:show-about"
	settingsEvent = "app:show-settings"
)

// applicationMenu 只留必要的選單。macOS：自建 App 選單（第一個選單一律被系統當成 App 選單，標題顯示為 App 名稱），
// 放「關於」「設定…（⌘,，macOS 慣例）」「隱藏」「結束」；Wails 內建的 menu.AppMenu() 無法插入自訂項目，所以不用它。
// Edit 仍用內建（WebView 的 ⌘C／⌘V／⌘Z 靠它運作），只保留到「全選」，之後的 Speech、Writing Tools、AutoFill 等由 menu_native_darwin.go 移除。
// Windows／Linux：「檔案 → 設定…」與「說明 → 關於」。
func applicationMenu(app *App) *menu.Menu {
	result := menu.NewMenu()
	emit := func(event string) menu.Callback {
		return func(*menu.CallbackData) { wailsruntime.EventsEmit(app.ctx, event) }
	}
	if runtime.GOOS == "darwin" {
		appMenu := result.AddSubmenu("SteamLoom Writer")
		appMenu.AddText("關於 SteamLoom Writer", nil, emit(aboutEvent))
		appMenu.AddSeparator()
		appMenu.AddText("設定…", keys.CmdOrCtrl(","), emit(settingsEvent))
		appMenu.AddSeparator()
		appMenu.AddText("隱藏 SteamLoom Writer", keys.CmdOrCtrl("h"), func(*menu.CallbackData) { wailsruntime.Hide(app.ctx) })
		appMenu.AddSeparator()
		// Quit 會經過 OnBeforeClose，未儲存變更的確認照常運作。
		appMenu.AddText("結束 SteamLoom Writer", keys.CmdOrCtrl("q"), func(*menu.CallbackData) { wailsruntime.Quit(app.ctx) })
		result.Append(menu.EditMenu())
		return result
	}
	result.AddSubmenu("檔案").AddText("設定…", keys.CmdOrCtrl(","), emit(settingsEvent))
	result.AddSubmenu("說明").AddText("關於 SteamLoom Writer", nil, emit(aboutEvent))
	return result
}
