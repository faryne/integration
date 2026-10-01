package storytelleroauth

import (
	"net/http"
	"strings"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/repository"
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

// TokenResult 是 /oauth/token 的結果；Grant 只有授權碼兌換（新建立 grant）時才有值，refresh 不記稽核。
type TokenResult struct {
	Output *storytellerModel.OAuthTokenOutput
	Grant  *GrantEvent
}

// tokenPair 是一組新發的明碼 token 與對應要寫進 grant 的雜湊／到期時間。
type tokenPair struct {
	access, refresh string
	grant           storytellerModel.OAuthGrant
}

func (s *Service) newTokenPair() (*tokenPair, error) {
	access, err := randomToken(AccessTokenPrefix, 32)
	if err != nil {
		return nil, err
	}
	refresh, err := randomToken(refreshPrefix, 32)
	if err != nil {
		return nil, err
	}
	now := s.now()
	return &tokenPair{access: access, refresh: refresh, grant: storytellerModel.OAuthGrant{
		AccessTokenHash: helper.SHA256Hex(access), AccessExpiresAt: now.Add(accessTokenTTL),
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
	return &TokenResult{Output: pair.output(), Grant: &GrantEvent{
		UserID: code.UserID, PublicID: publicID, ClientID: code.ClientID, ClientName: code.ClientName,
	}}, nil
}

// refresh 用 refresh token 換一組新的 access + refresh（rotation），舊的立即失效。
func (s *Service) refresh(input TokenRequest) (*TokenResult, error) {
	if input.RefreshToken == "" || input.ClientID == "" {
		return nil, invalidRequest("refresh_token、client_id 都是必填")
	}
	oldHash := helper.SHA256Hex(input.RefreshToken)
	grant, err := s.repo.OAuthGrantByRefreshHash(oldHash)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return nil, invalidGrant("refresh token 無效或已撤銷")
		}
		return nil, err
	}
	if grant.ClientID != input.ClientID {
		return nil, invalidGrant("client_id 與授權時不符")
	}
	if grant.RefreshExpiresAt.Before(s.now()) {
		return nil, invalidGrant("refresh token 已過期，請重新授權")
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
		// 同一個 refresh token 被併發換了兩次，只有先到的那次算數
		return nil, invalidGrant("refresh token 已被使用")
	}
	return &TokenResult{Output: pair.output()}, nil
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
	return &GrantEvent{
		UserID: grant.UserID, PublicID: grant.PublicID, ClientID: grant.ClientID,
		ClientName: displayName(grant.ClientName, grant.RedirectURIs),
	}, nil
}
