package helper

import (
	"errors"

	"faryne.dev/service/log"
)

// LogAndContinue 記錄錯誤並返回 true（表示發生錯誤）
// 適用於在迴圈中需要繼續處理的場景
func LogAndContinue(err error, msg string) bool {
	if err != nil {
		log.Logger().Error(msg + ": " + err.Error())
		return true
	}
	return false
}

// LogAndReturn 記錄錯誤並返回，方便鏈式呼叫
// 適用於需要傳播錯誤的場景
func LogAndReturn(err error, msg string) error {
	if err != nil {
		log.Logger().Error(msg + ": " + err.Error())
	}
	return err
}

// MustHandle 如果錯誤發生則 panic（用於關鍵初始化）
// 適用於啟動時的必要初始化，失敗時應該立即終止
func MustHandle(err error, msg string) {
	if err != nil {
		log.Logger().Panic(msg + ": " + err.Error())
	}
}

// Join 合併多個錯誤
func Join(errs ...error) error {
	return errors.Join(errs...)
}

// IsNil 檢查錯誤是否為 nil
func IsNil(err error) bool {
	return err == nil
}
