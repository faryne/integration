package api

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"strings"
)

// ProxyResponse 原樣交回前端：status 與未解包的回應本文，讓網站的 axios 呼叫（react-query hook）
// 在 Writer 裡拿到跟瀏覽器一樣的 response，錯誤處理（讀 custom_code、message）也不用改。
type ProxyResponse struct {
	Status      int    `json:"status"`
	ContentType string `json:"content_type"`
	Body        string `json:"body"`
}

// proxyMethods 只放網站 API 會用到的方法
var proxyMethods = map[string]bool{http.MethodGet: true, http.MethodPost: true, http.MethodPut: true, http.MethodPatch: true, http.MethodDelete: true}

// Proxy 把前端的網站 API 請求（/storyteller 底下的路徑，含 query string）帶上 Bearer 轉發出去。
// token 一樣只在 Go 端；只轉發到設定好的 API base，路徑不能自帶 host。body 是 JSON 文字，空字串＝沒有 body。
// 非 2xx 不算錯誤（由前端依 status 判斷），只有連線失敗、授權失效（not_logged_in）才回 error。
func (c *Client) Proxy(ctx context.Context, method, path, body string) (*ProxyResponse, error) {
	if !proxyMethods[method] {
		return nil, fmt.Errorf("不支援的 HTTP method：%s", method)
	}
	// 只檢查 ? 之前的路徑段：query 裡的搜尋字串可能本來就有「..」
	if route, _, _ := strings.Cut(path, "?"); !strings.HasPrefix(route, "/") || strings.Contains(route, "..") {
		return nil, fmt.Errorf("不合法的 API 路徑：%s", path)
	}
	var reader io.Reader
	if body != "" {
		reader = strings.NewReader(body)
	}
	resp, err := c.do(ctx, method, path, reader)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	payload, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("讀取 SteamLoom API %s 回應失敗：%w", path, err)
	}
	return &ProxyResponse{Status: resp.StatusCode, ContentType: resp.Header.Get("Content-Type"), Body: string(payload)}, nil
}
