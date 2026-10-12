package main

import (
	"context"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// SetUnsaved 由前端在編輯分頁「有沒有未存檔內容」改變時呼叫；關閉視窗／結束程式時據此決定要不要先問。
// 切換文件、離開專案這些 app 內的動作由前端自己的對話框處理，這裡只管視窗層級的關閉。
func (a *App) SetUnsaved(unsaved bool) { a.unsaved.Store(unsaved) }

// beforeClose 回傳 true 代表取消關閉。macOS 會顯示自訂按鈕文字；Windows／Linux 的詢問框固定是 Yes／No。
func (a *App) beforeClose(ctx context.Context) bool {
	if !a.unsaved.Load() {
		return false
	}
	const discard, cancel = "放棄並關閉", "取消"
	choice, err := runtime.MessageDialog(ctx, runtime.MessageDialogOptions{
		Type:          runtime.QuestionDialog,
		Title:         "有未存檔的內容",
		Message:       "關閉後這次的修改會遺失，確定要關閉嗎？",
		Buttons:       []string{discard, cancel},
		DefaultButton: cancel,
		CancelButton:  cancel,
	})
	return err != nil || (choice != discard && choice != "Yes")
}
