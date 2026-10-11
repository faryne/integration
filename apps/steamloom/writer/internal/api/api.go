// Package api 呼叫 SteamLoom 的 /storyteller-client REST API（Bearer token 認證）。
package api

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"faryne.dev/apps/steamloom/writer/internal/auth"
)

type Client struct {
	base    string
	session *auth.Session
	http    *http.Client
}

func New(base string, session *auth.Session) *Client {
	return &Client{base: base + "/storyteller-client", session: session, http: &http.Client{Timeout: 30 * time.Second}}
}

// envelope 是後端 service/output 的標準回應格式。
type envelope[T any] struct {
	Data    T      `json:"data"`
	Message string `json:"message"`
}

// get 帶上 access token 呼叫 API；401 代表授權已失效（過期或在網站上被撤銷），清掉憑證要求重新登入。
func get[T any](ctx context.Context, c *Client, path string) (T, error) {
	var out envelope[T]
	token, err := c.session.AccessToken(ctx)
	if err != nil {
		return out.Data, err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, c.base+path, nil)
	if err != nil {
		return out.Data, err
	}
	req.Header.Set("Authorization", "Bearer "+token)
	resp, err := c.http.Do(req)
	if err != nil {
		return out.Data, fmt.Errorf("無法連線到 SteamLoom：%w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusUnauthorized {
		c.session.Invalidate()
		return out.Data, auth.ErrNotLoggedIn
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return out.Data, fmt.Errorf("SteamLoom 回應格式錯誤（HTTP %d）", resp.StatusCode)
	}
	if resp.StatusCode >= http.StatusBadRequest {
		return out.Data, fmt.Errorf("SteamLoom 回應錯誤（HTTP %d）：%s", resp.StatusCode, out.Message)
	}
	return out.Data, nil
}

func (c *Client) Me(ctx context.Context) (*Profile, error) {
	return get[*Profile](ctx, c, "/me")
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
