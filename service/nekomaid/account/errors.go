// Package account 是 neko.maid.tw 的帳號：登入（帳號或 email）、舊會員搬進 Firebase、註冊、忘記密碼、
// email 驗證與合併、清除未驗證帳號。規格見 DevelopDocuments/nekomaid使用者與禁抓名單_2026-11-04.md §2。
package account

import (
	"fmt"
	"net/http"
)

// 回給前端的原因代碼：前端依這個決定要顯示哪個欄位（例如請使用者設新密碼）
const (
	ReasonInvalidCredentials = "invalid_credentials" // 帳號或密碼錯誤（不透露帳號是否存在）
	ReasonMerged             = "merged"              // 這個帳號已合併到別的帳號
	ReasonNeedPassword       = "need_password"       // 舊密碼太短，請設新密碼
	ReasonNeedEmail          = "need_email"          // 舊 email 不能用（或新 email 已被使用），請填新 email
	ReasonLegacyEmail        = "legacy_email"        // 註冊用的 email 是還沒搬家的舊會員
	ReasonEmailRegistered    = "email_registered"    // 註冊用的 email 已經註冊過
	ReasonInvalidInput       = "invalid_input"       // 欄位格式不對
	ReasonTooManyAttempts    = "too_many_attempts"   // 太頻繁
	ReasonLinkInvalid        = "link_invalid"        // 信件連結已用過或過期
)

// Error 帳號流程的預期錯誤；Message 是給使用者看的中文，MergedInto 只在 ReasonMerged 時有值
type Error struct {
	Status     int
	Reason     string
	Message    string
	MergedInto string
}

func (e *Error) Error() string { return e.Reason + ": " + e.Message }

func newError(status int, reason, format string, args ...any) *Error {
	return &Error{Status: status, Reason: reason, Message: fmt.Sprintf(format, args...)}
}

var (
	errInvalidCredentials = newError(http.StatusUnauthorized, ReasonInvalidCredentials, "帳號或密碼錯誤")
	errTooManyAttempts    = newError(http.StatusTooManyRequests, ReasonTooManyAttempts, "嘗試次數太多，請稍後再試")
	errLinkInvalid        = newError(http.StatusBadRequest, ReasonLinkInvalid, "這個連結已經用過或過期，請重新登入，系統會再寄一封新的信")
)

func errMerged(target string) *Error {
	e := newError(http.StatusConflict, ReasonMerged, "這個帳號已合併到「%s」，請改用 %s 登入", target, target)
	e.MergedInto = target
	return e
}

func errNeedPassword() *Error {
	return newError(http.StatusUnprocessableEntity, ReasonNeedPassword, "舊密碼太短，請設定至少 %d 個字的新密碼", minPasswordLength)
}

func errNeedEmail(message string) *Error {
	return newError(http.StatusUnprocessableEntity, ReasonNeedEmail, "%s", message)
}

func errInvalidInput(message string) *Error {
	return newError(http.StatusBadRequest, ReasonInvalidInput, "%s", message)
}
