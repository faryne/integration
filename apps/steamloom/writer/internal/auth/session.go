// Package auth 負責 Writer 跟 SteamLoom 之間的 OAuth：
// 登入走 Authorization Code + PKCE，由系統瀏覽器開授權頁、loopback 接回授權碼；
// 拿到的憑證存在鑰匙圈，API 呼叫前自動 refresh。
package auth

import (
	"context"
	"errors"
	"net/http"
	"net/url"
	"sync"
	"time"

	"faryne.dev/apps/steamloom/writer/internal/config"
	"faryne.dev/apps/steamloom/writer/internal/tokenstore"
)

const (
	// 授權碼在 server 端只活 10 分鐘，等太久也沒意義
	loginTimeout = 10 * time.Minute
	// access token 剩不到這麼久就先 refresh，避免送出去的途中剛好過期
	refreshLeeway = 2 * time.Minute
)

var (
	// ErrNotLoggedIn：沒有憑證，或 refresh token 已失效／被撤銷，前端收到要切回登入畫面
	ErrNotLoggedIn = errors.New("not_logged_in")
	// ErrLoginCanceled：使用者在 app 按取消，或在授權頁按拒絕，前端不用提示錯誤
	ErrLoginCanceled = errors.New("login_canceled")
)

type Session struct {
	cfg     config.Config
	store   *tokenstore.Store
	http    *http.Client
	openURL func(string)

	// mu 保護 credential；refresh 會 rotation，整段加鎖才不會兩個請求各自 refresh 互相作廢
	mu         sync.Mutex
	credential *tokenstore.Credential
	loaded     bool

	loginMu     sync.Mutex
	cancelLogin context.CancelFunc
}

// New 的 openURL 由呼叫端提供（Wails 用 runtime.BrowserOpenURL 開系統瀏覽器）。
func New(cfg config.Config, store *tokenstore.Store, openURL func(string)) *Session {
	return &Session{cfg: cfg, store: store, http: &http.Client{Timeout: 30 * time.Second}, openURL: openURL}
}

// Login 跑完整個授權流程，阻塞到使用者在瀏覽器同意、取消，或逾時為止。
func (s *Session) Login(parent context.Context) error {
	ctx, cancel := context.WithTimeout(parent, loginTimeout)
	defer cancel()
	s.loginMu.Lock()
	if s.cancelLogin != nil {
		s.cancelLogin()
	}
	s.cancelLogin = cancel
	s.loginMu.Unlock()

	state, verifier := randomString(), randomString()
	redirectURI, results, shutdown, err := listenLoopback(state)
	if err != nil {
		return err
	}
	defer shutdown()
	clientID, err := s.register(ctx, redirectURI)
	if err != nil {
		return err
	}
	s.openURL(s.cfg.AuthorizeURL + "?" + url.Values{
		"response_type":         {"code"},
		"client_id":             {clientID},
		"redirect_uri":          {redirectURI},
		"code_challenge":        {codeChallenge(verifier)},
		"code_challenge_method": {"S256"},
		"state":                 {state},
	}.Encode())

	var code string
	select {
	case result := <-results:
		if result.err != nil {
			return result.err
		}
		code = result.code
	case <-ctx.Done():
		if errors.Is(ctx.Err(), context.DeadlineExceeded) {
			return errors.New("等待授權逾時，請重新登入")
		}
		return ErrLoginCanceled
	}

	token, expiresAt, err := s.requestToken(ctx, url.Values{
		"grant_type":    {"authorization_code"},
		"code":          {code},
		"redirect_uri":  {redirectURI},
		"client_id":     {clientID},
		"code_verifier": {verifier},
	})
	if err != nil {
		return err
	}
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.saveLocked(&tokenstore.Credential{
		ClientID: clientID, AccessToken: token.AccessToken, RefreshToken: token.RefreshToken, ExpiresAt: expiresAt,
	})
}

// CancelLogin 給登入中畫面的「取消」按鈕用。
func (s *Session) CancelLogin() {
	s.loginMu.Lock()
	defer s.loginMu.Unlock()
	if s.cancelLogin != nil {
		s.cancelLogin()
		s.cancelLogin = nil
	}
}

// AccessToken 回傳可用的 access token，快到期就先 refresh。
func (s *Session) AccessToken(ctx context.Context) (string, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.loadLocked(); err != nil {
		return "", err
	}
	if s.credential == nil {
		return "", ErrNotLoggedIn
	}
	if time.Until(s.credential.ExpiresAt) > refreshLeeway {
		return s.credential.AccessToken, nil
	}
	token, expiresAt, err := s.requestToken(ctx, url.Values{
		"grant_type":    {"refresh_token"},
		"refresh_token": {s.credential.RefreshToken},
		"client_id":     {s.credential.ClientID},
	})
	// server 明確拒絕（invalid_grant 等）代表授權已失效，只能重新登入；連線錯誤則保留憑證讓使用者重試
	var oauthErr *OAuthError
	if errors.As(err, &oauthErr) {
		s.clearLocked()
		return "", ErrNotLoggedIn
	}
	if err != nil {
		return "", err
	}
	next := *s.credential
	next.AccessToken, next.RefreshToken, next.ExpiresAt = token.AccessToken, token.RefreshToken, expiresAt
	if err := s.saveLocked(&next); err != nil {
		return "", err
	}
	return next.AccessToken, nil
}

// Invalidate 在 API 回 401 時呼叫（例如使用者在網站上撤銷了授權），清掉本機憑證。
func (s *Session) Invalidate() {
	s.mu.Lock()
	defer s.mu.Unlock()
	s.clearLocked()
}

// Logout 先嘗試撤銷 server 上的授權，再清本機憑證；撤銷失敗不影響登出。
func (s *Session) Logout(ctx context.Context) error {
	s.mu.Lock()
	defer s.mu.Unlock()
	if err := s.loadLocked(); err != nil {
		return err
	}
	if s.credential != nil {
		s.revoke(ctx, s.credential.RefreshToken)
	}
	return s.clearLocked()
}

func (s *Session) loadLocked() error {
	if s.loaded {
		return nil
	}
	credential, err := s.store.Load()
	if err != nil {
		return err
	}
	s.credential, s.loaded = credential, true
	return nil
}

func (s *Session) saveLocked(credential *tokenstore.Credential) error {
	if err := s.store.Save(credential); err != nil {
		return err
	}
	s.credential, s.loaded = credential, true
	return nil
}

func (s *Session) clearLocked() error {
	s.credential, s.loaded = nil, true
	return s.store.Delete()
}
