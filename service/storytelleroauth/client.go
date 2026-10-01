package storytelleroauth

import (
	"encoding/json"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

const (
	maxRedirectURIs   = 10
	maxClientNameRune = 100
)

// 這些 scheme 拿到授權碼也沒有正當用途，一律拒絕；其他自訂 scheme 照 RFC 8252 給原生 app 用。
var forbiddenRedirectSchemes = map[string]bool{
	"javascript": true, "data": true, "file": true, "vbscript": true, "blob": true, "about": true,
}

// Register 是 RFC 7591 Dynamic Client Registration；只發 public client（PKCE、無 secret）。
func (s *Service) Register(ip string, input storytellerModel.OAuthClientRegistrationRequest) (*storytellerModel.OAuthClientRegistrationOutput, error) {
	allowed, err := s.limiter.Allow("storyteller:oauth:register:"+ip, registerLimitPerHour, time.Hour)
	if err != nil {
		return nil, err
	}
	if !allowed {
		return nil, newError(http.StatusTooManyRequests, "too_many_requests", "註冊次數過多，請稍後再試")
	}
	if len(input.RedirectURIs) == 0 || len(input.RedirectURIs) > maxRedirectURIs {
		return nil, newError(http.StatusBadRequest, "invalid_redirect_uri", "redirect_uris 必須有 1 到 10 個")
	}
	for _, uri := range input.RedirectURIs {
		if err := validateRedirectURI(uri); err != nil {
			return nil, err
		}
	}
	// 只支援 public client：要求用 client secret 驗證的註冊直接拒絕，免得對方以為有 secret 保護
	if method := input.TokenEndpointAuthMethod; method != "" && method != "none" {
		return nil, newError(http.StatusBadRequest, "invalid_client_metadata", "只支援 token_endpoint_auth_method=none（PKCE）")
	}
	clientID, err := randomToken(clientIDPrefix, 16)
	if err != nil {
		return nil, err
	}
	redirectURIs, _ := json.Marshal(input.RedirectURIs)
	row := &storytellerModel.OAuthClient{
		ClientID:     clientID,
		ClientName:   truncateRunes(strings.TrimSpace(input.ClientName), maxClientNameRune),
		RedirectURIs: string(redirectURIs),
	}
	if err := s.repo.CreateOAuthClient(row); err != nil {
		return nil, err
	}
	return &storytellerModel.OAuthClientRegistrationOutput{
		ClientID:                row.ClientID,
		ClientIDIssuedAt:        s.now().Unix(),
		ClientName:              row.ClientName,
		RedirectURIs:            input.RedirectURIs,
		GrantTypes:              []string{"authorization_code", "refresh_token"},
		ResponseTypes:           []string{"code"},
		TokenEndpointAuthMethod: "none",
	}, nil
}

// validateRedirectURI：https 任意網域、http 只限 loopback、自訂 scheme 給原生 app，不得帶 fragment。
func validateRedirectURI(raw string) *Error {
	invalid := newError(http.StatusBadRequest, "invalid_redirect_uri", "redirect_uri 不合法："+raw)
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Scheme == "" || parsed.Fragment != "" || strings.Contains(raw, "#") {
		return invalid
	}
	switch scheme := strings.ToLower(parsed.Scheme); {
	case scheme == "https":
		if parsed.Host == "" {
			return invalid
		}
	case scheme == "http":
		if !isLoopbackHost(parsed.Hostname()) {
			return invalid
		}
	case forbiddenRedirectSchemes[scheme]:
		return invalid
	}
	return nil
}

func isLoopbackHost(host string) bool {
	if strings.EqualFold(host, "localhost") {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

func clientRedirectURIs(raw string) []string {
	uris := make([]string, 0)
	_ = json.Unmarshal([]byte(raw), &uris)
	return uris
}

// redirectHost 給授權頁與列表顯示「授權後會跳去哪」；自訂 scheme 沒有 host 時顯示 scheme。
func redirectHost(raw string) string {
	parsed, err := url.Parse(raw)
	if err != nil {
		return ""
	}
	if parsed.Host != "" {
		return parsed.Host
	}
	return parsed.Scheme + ":"
}

// displayName：client 沒報名稱時用跳轉網域代替，畫面上不會出現空白名稱。
func displayName(name, redirectURIs string) string {
	if name != "" {
		return name
	}
	if uris := clientRedirectURIs(redirectURIs); len(uris) > 0 {
		return redirectHost(uris[0])
	}
	return "未命名應用程式"
}

func truncateRunes(value string, limit int) string {
	runes := []rune(value)
	if len(runes) <= limit {
		return value
	}
	return string(runes[:limit])
}
