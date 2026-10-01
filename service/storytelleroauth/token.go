package storytelleroauth

import (
	"net/http"
	"strings"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/repository"
	"faryne.dev/service/crypto"
	"faryne.dev/service/helper"
)

// TokenRequest 是 /oauth/token 的 form 參數（application/x-www-form-urlencoded）。
type TokenRequest struct {
	GrantType    string
	Code         string
	RedirectURI  string
	ClientID     string
	CodeVerifier string
	RefreshToken string
	Resource     string
}

// GrantEvent 是 grant 建立或被撤銷時要寫進稽核的識別資料；token 端點沒有 session，
// 由 controller 拿這份資料補上稽核的 actor 與憑證。
type GrantEvent struct {
	UserID     uint64
	PublicID   string
	ClientID   string
	ClientName string
}

// TokenAudit 是 /oauth/token 這次要寫的稽核事件；controller 依此補上 actor 與憑證後送出。
type TokenAudit struct {
	Action string
	Denied bool
	// 失敗原因：expired／revoked／reused／client_mismatch／concurrent
	Reason string
	Grant  GrantEvent
}

// TokenResult 是 /oauth/token 的結果。Audit 為 nil 代表這次不記稽核（效期內提早 refresh、
// 或完全對不到任何 grant 的 token）；refresh 被拒時 Output 為 nil、Audit 仍有值。
type TokenResult struct {
	Output *storytellerModel.OAuthTokenOutput
	Audit  *TokenAudit
}

const (
	auditGrantCreate   = "oauth.grant.create"
	auditTokenRefresh  = "oauth.token.refresh"
	auditRefreshDenied = "auth.oauth.refresh.denied"
)

func grantEvent(grant *storytellerModel.OAuthGrantWithClient) GrantEvent {
	return GrantEvent{
		UserID: grant.UserID, PublicID: grant.PublicID, ClientID: grant.ClientID,
		ClientName: displayName(grant.ClientName, grant.RedirectURIs),
	}
}

// deniedRefresh 組出 refresh 被拒的結果：回 invalid_grant，同時帶出要記的稽核事件。
func deniedRefresh(grant *storytellerModel.OAuthGrantWithClient, reason, description string) (*TokenResult, error) {
	return &TokenResult{Audit: &TokenAudit{
		Action: auditRefreshDenied, Denied: true, Reason: reason, Grant: grantEvent(grant),
	}}, invalidGrant(description)
}

// tokenPair 是一組新發的明碼 token 與對應要寫進 grant 的雜湊／到期時間。
type tokenPair struct {
	access, refresh string
	grant           storytellerModel.OAuthGrant
}

// newTokenPair 發一組新 token：驗證只用雜湊，另外存一份 access token 加密副本，
// 讓效期內提早 refresh 時能把原本那支還給 client。
func (s *Service) newTokenPair() (*tokenPair, error) {
	access, err := randomToken(AccessTokenPrefix, 32)
	if err != nil {
		return nil, err
	}
	refresh, err := randomToken(refreshPrefix, 32)
	if err != nil {
		return nil, err
	}
	sealed, err := s.seal(access)
	if err != nil {
		return nil, err
	}
	now := s.now()
	return &tokenPair{access: access, refresh: refresh, grant: storytellerModel.OAuthGrant{
		AccessTokenHash: helper.SHA256Hex(access), AccessExpiresAt: now.Add(accessTokenTTL),
		AccessTokenEncrypted: sealed.Ciphertext, AccessTokenDataKey: sealed.DataKey, AccessTokenKeyID: sealed.KeyID,
		RefreshTokenHash: helper.SHA256Hex(refresh), RefreshExpiresAt: now.Add(refreshTokenTTL),
	}}, nil
}

func (p *tokenPair) output() *storytellerModel.OAuthTokenOutput {
	return &storytellerModel.OAuthTokenOutput{
		AccessToken: p.access, TokenType: "Bearer", ExpiresIn: int(accessTokenTTL.Seconds()), RefreshToken: p.refresh,
	}
}

func (s *Service) Token(input TokenRequest) (*TokenResult, error) {
	switch input.GrantType {
	case "authorization_code":
		return s.exchangeCode(input)
	case "refresh_token":
		return s.refresh(input)
	default:
		return nil, newError(http.StatusBadRequest, "unsupported_grant_type", "只支援 authorization_code 與 refresh_token")
	}
}

// exchangeCode 用授權碼換第一組 token，同時建立 grant（「OAuth Token」頁上的一列）。
func (s *Service) exchangeCode(input TokenRequest) (*TokenResult, error) {
	if input.Code == "" || input.ClientID == "" || input.RedirectURI == "" || input.CodeVerifier == "" {
		return nil, invalidRequest("code、client_id、redirect_uri、code_verifier 都是必填")
	}
	// 先消耗掉授權碼：不論後面驗證成功與否，這組碼都不能再用
	code, err := s.codes.Consume(input.Code)
	if err != nil {
		return nil, err
	}
	if code == nil {
		return nil, invalidGrant("授權碼無效、已過期或已使用")
	}
	if code.ClientID != input.ClientID || code.RedirectURI != input.RedirectURI {
		return nil, invalidGrant("client_id 或 redirect_uri 與授權時不符")
	}
	if !verifyPKCE(input.CodeVerifier, code.CodeChallenge) {
		return nil, invalidGrant("code_verifier 驗證失敗")
	}
	if input.Resource != "" && strings.TrimRight(input.Resource, "/") != code.Resource {
		return nil, newError(http.StatusBadRequest, "invalid_target", "resource 與授權時不符")
	}
	pair, err := s.newTokenPair()
	if err != nil {
		return nil, err
	}
	publicID, err := randomToken(grantIDPrefix, 8)
	if err != nil {
		return nil, err
	}
	grant := pair.grant
	grant.PublicID, grant.UserID, grant.OAuthClientID, grant.Resource = publicID, code.UserID, code.ClientDBID, code.Resource
	if err := s.repo.CreateOAuthGrant(&grant); err != nil {
		return nil, err
	}
	return &TokenResult{Output: pair.output(), Audit: &TokenAudit{Action: auditGrantCreate, Grant: GrantEvent{
		UserID: code.UserID, PublicID: publicID, ClientID: code.ClientID, ClientName: code.ClientName,
	}}}, nil
}

// refresh 有三種結果：
//  1. access token 還在效期內：還給 client 原本那支（expires_in 是剩餘秒數）與同一支 refresh token，不換發、不記稽核。
//  2. access token 已過期：換一組新的 access + refresh（rotation，舊的立即失效），記 oauth.token.refresh。
//  3. refresh token 已撤銷、已被輪替、過期或 client 不符：回 invalid_grant，記 auth.oauth.refresh.denied。
func (s *Service) refresh(input TokenRequest) (*TokenResult, error) {
	if input.RefreshToken == "" || input.ClientID == "" {
		return nil, invalidRequest("refresh_token、client_id 都是必填")
	}
	oldHash := helper.SHA256Hex(input.RefreshToken)
	grant, err := s.repo.OAuthGrantByRefreshHash(oldHash)
	if err != nil {
		if !repository.IsRecordNotFound(err) {
			return nil, err
		}
		// 不是目前有效的 refresh token：查得到所屬 grant（已撤銷或已被輪替）就記稽核，完全陌生的 token 不記
		if stale, staleErr := s.repo.OAuthGrantForRefreshAudit(oldHash); staleErr == nil {
			reason := "reused"
			if stale.IsDeleted {
				reason = "revoked"
			}
			return deniedRefresh(stale, reason, "refresh token 無效或已撤銷")
		}
		return nil, invalidGrant("refresh token 無效或已撤銷")
	}
	if grant.ClientID != input.ClientID {
		return deniedRefresh(grant, "client_mismatch", "client_id 與授權時不符")
	}
	now := s.now()
	if grant.RefreshExpiresAt.Before(now) {
		return deniedRefresh(grant, "expired", "refresh token 已過期，請重新授權")
	}
	if grant.AccessExpiresAt.After(now) {
		access, openErr := s.open(crypto.Envelope{
			Ciphertext: grant.AccessTokenEncrypted, DataKey: grant.AccessTokenDataKey, KeyID: grant.AccessTokenKeyID,
		})
		// 解不開（例如舊資料沒有加密副本、master key 已移除）就當作過期，照常換發
		if openErr == nil {
			return &TokenResult{Output: &storytellerModel.OAuthTokenOutput{
				AccessToken: access, TokenType: "Bearer", RefreshToken: input.RefreshToken,
				ExpiresIn: int(grant.AccessExpiresAt.Sub(now).Seconds()),
			}}, nil
		}
	}
	pair, err := s.newTokenPair()
	if err != nil {
		return nil, err
	}
	rotated, err := s.repo.RotateOAuthGrantTokens(grant.ID, oldHash, pair.grant)
	if err != nil {
		return nil, err
	}
	if !rotated {
		// 同一個 refresh token 在 access token 過期後被併發換了兩次，只有先到的那次算數
		return deniedRefresh(grant, "concurrent", "refresh token 已被使用")
	}
	return &TokenResult{Output: pair.output(), Audit: &TokenAudit{Action: auditTokenRefresh, Grant: grantEvent(grant)}}, nil
}

// Revoke 是 RFC 7009：access 或 refresh token 都可以，撤銷整個 grant；
// 找不到也當成功（回傳 nil），不讓呼叫端拿來探測 token 是否存在。
func (s *Service) Revoke(token string) (*GrantEvent, error) {
	hash := helper.SHA256Hex(strings.TrimSpace(token))
	grant, err := s.repo.OAuthGrantByAccessHash(hash)
	if err != nil {
		grant, err = s.repo.OAuthGrantByRefreshHash(hash)
	}
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return nil, nil
		}
		return nil, err
	}
	if err := s.repo.DeleteOAuthGrant(grant.ID); err != nil {
		return nil, err
	}
	event := grantEvent(grant)
	return &event, nil
}
