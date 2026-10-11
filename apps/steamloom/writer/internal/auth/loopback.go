package auth

import (
	"errors"
	"fmt"
	"html"
	"net"
	"net/http"
	"time"
)

// callbackResult 是授權頁導回 loopback 時帶回的結果。
type callbackResult struct {
	code string
	err  error
}

// listenLoopback 在 127.0.0.1 的隨機埠開一個接 /callback 的 HTTP server（RFC 8252 §7.3）。
// state 不符的請求直接 400、不算數，避免本機其他程式亂打一發就把登入流程中斷。
func listenLoopback(state string) (string, <-chan callbackResult, func(), error) {
	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		return "", nil, nil, fmt.Errorf("無法開啟本機授權回呼：%w", err)
	}
	results := make(chan callbackResult, 1)
	mux := http.NewServeMux()
	mux.HandleFunc("/callback", func(w http.ResponseWriter, r *http.Request) {
		query := r.URL.Query()
		if query.Get("state") != state {
			http.Error(w, "invalid state", http.StatusBadRequest)
			return
		}
		result := callbackResult{code: query.Get("code")}
		switch code := query.Get("error"); {
		case code == "access_denied":
			result.err = ErrLoginCanceled
		case code != "":
			result.err = &OAuthError{Code: code, Description: query.Get("error_description")}
		case result.code == "":
			result.err = errors.New("授權回應缺少 code，請重新登入")
		}
		writeCallbackPage(w, result.err)
		// 只收第一個結果，重新整理頁面之類的重複請求直接忽略
		select {
		case results <- result:
		default:
		}
	})
	server := &http.Server{Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	go func() { _ = server.Serve(listener) }()
	redirectURI := fmt.Sprintf("http://127.0.0.1:%d/callback", listener.Addr().(*net.TCPAddr).Port)
	return redirectURI, results, func() { _ = server.Close() }, nil
}

// writeCallbackPage 是瀏覽器分頁最後看到的畫面，告訴使用者回到 app。
func writeCallbackPage(w http.ResponseWriter, err error) {
	message := "授權完成，可以關閉這個分頁回到 SteamLoom Writer。"
	switch {
	case errors.Is(err, ErrLoginCanceled):
		message = "已取消授權，可以關閉這個分頁。"
	case err != nil:
		message = "授權沒有完成：" + err.Error()
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = fmt.Fprintf(w, `<!doctype html><html lang="zh-Hant"><meta charset="utf-8"><title>SteamLoom Writer</title>
<body style="margin:0;height:100vh;display:grid;place-items:center;background:#100b18;color:#f4f0ff;font-family:'Noto Sans TC',system-ui,sans-serif">
<p>%s</p></body></html>`, html.EscapeString(message))
}
