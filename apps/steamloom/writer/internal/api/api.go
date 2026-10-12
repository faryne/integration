// Package api 呼叫 SteamLoom 網站的 /storyteller REST API；帶 Bearer token 時後端會把它轉成 session，
// 跟網站共用同一組路由與回應格式（見 route/storyteller.go 的 authenticated 群組）。
package api

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"faryne.dev/apps/steamloom/writer/internal/auth"
)

type Client struct {
	base    string
	session *auth.Session
	http    *http.Client
}

func New(base string, session *auth.Session) *Client {
	return &Client{base: base + "/storyteller", session: session, http: &http.Client{Timeout: 30 * time.Second}}
}

// envelope 是後端 service/output 的標準回應格式。
type envelope[T any] struct {
	Data    T      `json:"data"`
	Message string `json:"message"`
}

// get 是讀取用的 request。
func get[T any](ctx context.Context, c *Client, path string) (T, error) {
	return request[T](ctx, c, http.MethodGet, path, nil)
}

// request 帶上 access token 呼叫 API，body 非 nil 時以 JSON 送出（寫入用）。只有 401 且 WWW-Authenticate 帶
// error="invalid_token"（RFC 6750）才代表 token 本身失效（過期或在網站上被撤銷），這時才清掉憑證要求重新登入；
// 其他 401（後端版本不對、代理設定錯誤）只回報錯誤、保留憑證，避免一次部署時間差就把使用者登出。
func request[T any](ctx context.Context, c *Client, method, path string, body any) (T, error) {
	var out envelope[T]
	token, err := c.session.AccessToken(ctx)
	if err != nil {
		return out.Data, err
	}
	var reader io.Reader
	if body != nil {
		payload, err := json.Marshal(body)
		if err != nil {
			return out.Data, err
		}
		reader = bytes.NewReader(payload)
	}
	req, err := http.NewRequestWithContext(ctx, method, c.base+path, reader)
	if err != nil {
		return out.Data, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	resp, err := c.http.Do(req)
	if err != nil {
		return out.Data, fmt.Errorf("無法連線到 SteamLoom：%w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusUnauthorized && strings.Contains(resp.Header.Get("WWW-Authenticate"), `error="invalid_token"`) {
		c.session.Invalidate()
		return out.Data, auth.ErrNotLoggedIn
	}
	return decodeResponse[T](resp, path)
}

func decodeResponse[T any](resp *http.Response, path string) (T, error) {
	var out envelope[T]
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return out.Data, fmt.Errorf("讀取 SteamLoom API %s 回應失敗：%w", path, err)
	}
	if err := json.Unmarshal(body, &out); err != nil {
		// Fiber 的舊 fallback 會把未包裝的 server error 回成 HTTP 200 JSON 字串；保留原訊息才能定位根因。
		var message string
		if json.Unmarshal(body, &message) == nil && strings.TrimSpace(message) != "" {
			return out.Data, fmt.Errorf("SteamLoom API %s 回應錯誤（HTTP %d）：%s", path, resp.StatusCode, message)
		}
		contentType := strings.TrimSpace(strings.Split(resp.Header.Get("Content-Type"), ";")[0])
		return out.Data, fmt.Errorf("SteamLoom API %s 回應格式錯誤（HTTP %d，Content-Type %s）", path, resp.StatusCode, contentType)
	}
	if resp.StatusCode >= http.StatusBadRequest {
		return out.Data, fmt.Errorf("SteamLoom API %s 回應錯誤（HTTP %d）：%s", path, resp.StatusCode, out.Message)
	}
	return out.Data, nil
}

func (c *Client) Me(ctx context.Context) (*Profile, error) {
	return get[*Profile](ctx, c, "/user")
}

func (c *Client) Projects(ctx context.Context) ([]Project, error) {
	rows, err := get[[]projectRow](ctx, c, "/projects")
	if err != nil {
		return nil, err
	}
	projects := make([]Project, len(rows))
	for i, row := range rows {
		projects[i] = row.toProject()
	}
	return projects, nil
}

// joinErrors 合併多個請求的錯誤；授權失效時每個請求都會回 not_logged_in，單獨回傳這個代碼前端才認得出來。
func joinErrors(errs []error) error {
	for _, err := range errs {
		if errors.Is(err, auth.ErrNotLoggedIn) {
			return err
		}
	}
	return errors.Join(errs...)
}
