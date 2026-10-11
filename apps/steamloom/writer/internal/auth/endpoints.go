package auth

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
	"time"
)

const clientName = "SteamLoom Writer"

// tokenResponse 是 RFC 6749 的 token 回應；錯誤時只有 error／error_description。
type tokenResponse struct {
	AccessToken      string `json:"access_token"`
	RefreshToken     string `json:"refresh_token"`
	ExpiresIn        int    `json:"expires_in"`
	Error            string `json:"error"`
	ErrorDescription string `json:"error_description"`
}

// OAuthError 保留 server 回的 error code，讓呼叫端分辨 invalid_grant（要重新登入）跟其他錯誤。
type OAuthError struct{ Code, Description string }

func (e *OAuthError) Error() string {
	if e.Description != "" {
		return e.Description
	}
	return e.Code
}

// register 走 Dynamic Client Registration：每次登入用當下的 loopback 埠號註冊一個 public client，
// redirect_uri 才能跟 server 的「完全相同」比對規則對上；沒走完授權的 client 由 server 定期清掉。
func (s *Session) register(ctx context.Context, redirectURI string) (string, error) {
	body, _ := json.Marshal(map[string]any{
		"client_name":                clientName,
		"redirect_uris":              []string{redirectURI},
		"token_endpoint_auth_method": "none",
		"grant_types":                []string{"authorization_code", "refresh_token"},
		"response_types":             []string{"code"},
	})
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.cfg.Issuer+"/oauth/register", bytes.NewReader(body))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/json")
	var out struct {
		ClientID         string `json:"client_id"`
		Error            string `json:"error"`
		ErrorDescription string `json:"error_description"`
	}
	if err := s.do(req, &out); err != nil {
		return "", err
	}
	if out.ClientID == "" {
		return "", &OAuthError{Code: out.Error, Description: out.ErrorDescription}
	}
	return out.ClientID, nil
}

// requestToken 打 token 端點（authorization_code 與 refresh_token 共用），成功回傳換算好到期時間的結果。
func (s *Session) requestToken(ctx context.Context, form url.Values) (*tokenResponse, time.Time, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.cfg.Issuer+"/oauth/token", strings.NewReader(form.Encode()))
	if err != nil {
		return nil, time.Time{}, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	var out tokenResponse
	if err := s.do(req, &out); err != nil {
		return nil, time.Time{}, err
	}
	if out.AccessToken == "" {
		return nil, time.Time{}, &OAuthError{Code: out.Error, Description: out.ErrorDescription}
	}
	return &out, time.Now().Add(time.Duration(out.ExpiresIn) * time.Second), nil
}

// revoke 是登出時順手撤銷授權（RFC 7009），失敗也不影響本機登出。
func (s *Session) revoke(ctx context.Context, token string) {
	form := url.Values{"token": {token}}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.cfg.Issuer+"/oauth/revoke", strings.NewReader(form.Encode()))
	if err != nil {
		return
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	_ = s.do(req, nil)
}

// do 送出請求並解析 JSON；OAuth 端點的錯誤也是 JSON body，所以非 2xx 照樣解析交給呼叫端判斷。
func (s *Session) do(req *http.Request, out any) error {
	resp, err := s.http.Do(req)
	if err != nil {
		return fmt.Errorf("無法連線到 SteamLoom：%w", err)
	}
	defer resp.Body.Close()
	if out == nil {
		return nil
	}
	if err := json.NewDecoder(resp.Body).Decode(out); err != nil {
		return fmt.Errorf("SteamLoom 回應格式錯誤（HTTP %d）", resp.StatusCode)
	}
	return nil
}
