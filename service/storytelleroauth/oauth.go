// Package storytelleroauth 是 storyteller 的 OAuth 2.1 authorization server（最小子集）：
// Authorization Code + PKCE(S256)、Refresh Token rotation、Dynamic Client Registration。
// 刻意不耦合 MCP——MCP 只是第一個使用者，之後單機版 publish 等 client 共用同一套。
// 規格見 DevelopDocuments/storyteller/OAuth授權_2026-10-01.md。
package storytelleroauth

import (
	"crypto/rand"
	"encoding/hex"
	"net/http"
	"strings"
	"time"

	"faryne.dev/config"
	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/model/enum"
	storytellerRepo "faryne.dev/repository/storyteller"
	"faryne.dev/service/client"
	"faryne.dev/service/crypto"
)

const (
	AccessTokenPrefix = "sto_"
	refreshPrefix     = "str_"
	codePrefix        = "stc_"
	clientIDPrefix    = "stcl_"
	grantIDPrefix     = "oag_"

	// access token 24 小時；效期內提早 refresh 會拿回原本那支（見 token.go 的 refresh）
	accessTokenTTL  = 24 * time.Hour
	refreshTokenTTL = 30 * 24 * time.Hour
	codeTTL         = 10 * time.Minute
	// 沒產生過 grant 的 DCR client 保留多久才清掉
	unusedClientTTL = 7 * 24 * time.Hour
	// DCR 是匿名公開端點，依 IP 限流
	registerLimitPerHour = 20
)

// Error 對應 RFC 6749／7591 的錯誤格式，controller 直接輸出 {error, error_description}。
type Error struct {
	Status      int
	Code        string
	Description string
}

func (e *Error) Error() string { return e.Code + ": " + e.Description }

func newError(status int, code, description string) *Error {
	return &Error{Status: status, Code: code, Description: description}
}

func invalidRequest(description string) *Error {
	return newError(http.StatusBadRequest, "invalid_request", description)
}

func invalidGrant(description string) *Error {
	return newError(http.StatusBadRequest, "invalid_grant", description)
}

// ErrPenNameRequired：還沒設筆名的帳號不能授權（跟網站上「沒筆名不能做事」一致）。
var ErrPenNameRequired = newError(http.StatusConflict, "pen_name_required", "請先設定筆名再授權")

type oauthRepository interface {
	CreateOAuthClient(*storytellerModel.OAuthClient) error
	OAuthClientByClientID(string) (*storytellerModel.OAuthClient, error)
	DeleteUnusedOAuthClients(time.Time) (int64, error)
	CreateOAuthGrant(*storytellerModel.OAuthGrant) error
	OAuthGrants(uint64) ([]storytellerModel.OAuthGrantWithClient, error)
	OAuthGrantByPublicID(uint64, string) (*storytellerModel.OAuthGrantWithClient, error)
	OAuthGrantByAccessHash(string) (*storytellerModel.OAuthGrantWithClient, error)
	OAuthGrantByRefreshHash(string) (*storytellerModel.OAuthGrantWithClient, error)
	RotateOAuthGrantTokens(uint64, string, storytellerModel.OAuthGrant) (bool, error)
	DeleteOAuthGrant(uint64) error
	TouchOAuthGrantLastUsed(uint64) error
	OAuthGrantForRefreshAudit(string) (*storytellerModel.OAuthGrantWithClient, error)
	UserProfile(uint64) (*storytellerModel.UserProfile, error)
}

type Service struct {
	repo    oauthRepository
	codes   codeStore
	limiter rateLimiter
	issuer  string
	now     func() time.Time
	// access token 加密副本的加解密；正式環境走 master key envelope，測試可以換掉
	seal func(string) (*crypto.Envelope, error)
	open func(crypto.Envelope) (string, error)
}

func NewService() *Service {
	redisClient := client.GetRedis(enum.RedisDefault)
	return &Service{
		repo:    storytellerRepo.NewRepository(),
		codes:   redisCodeStore{redis: redisClient},
		limiter: redisRateLimiter{redis: redisClient},
		issuer:  strings.TrimRight(config.EnvConfig().StorytellerOAuthIssuer, "/"),
		now:     time.Now,
		seal:    crypto.SealWithMasterKey,
		open:    crypto.OpenWithMasterKey,
	}
}

// Resource 是 token 綁定的 MCP 網址（RFC 8707），也是 protected resource metadata 的 resource。
func (s *Service) Resource() string { return s.issuer + "/mcp" }

// randomToken 產生帶前綴的 32 bytes 隨機字串；token、授權碼都只存 SHA-256。
func randomToken(prefix string, size int) (string, error) {
	buf := make([]byte, size)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return prefix + hex.EncodeToString(buf), nil
}
