package storytelleroauth

import (
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"net/http"
	"net/url"
	"regexp"
	"slices"
	"strings"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/repository"
	notifyService "faryne.dev/service/storytellernotify"
)

// PKCE code_verifier／code_challenge 都是 RFC 7636 的 unreserved 字元、43~128 字。
var pkcePattern = regexp.MustCompile(`^[A-Za-z0-9\-._~]{43,128}$`)

// resolveClient 驗證 client_id 與 redirect_uri；這兩個有錯時**不能** redirect（防 open redirect），
// 授權頁只顯示錯誤。
func (s *Service) resolveClient(input storytellerModel.OAuthAuthorizeRequest) (*storytellerModel.OAuthClient, *Error) {
	invalid := newError(http.StatusBadRequest, "invalid_client", "client_id 或 redirect_uri 不正確")
	if input.ClientID == "" || input.RedirectURI == "" {
		return nil, invalid
	}
	client, err := s.repo.OAuthClientByClientID(input.ClientID)
	if err != nil {
		return nil, invalid
	}
	// redirect_uri 必須跟註冊時的其中一個完全相同，不做前綴或萬用比對
	if !slices.Contains(clientRedirectURIs(client.RedirectURIs), input.RedirectURI) {
		return nil, invalid
	}
	return client, nil
}

// validateAuthorizeParams 驗證 client 以外的參數；這類錯誤依 RFC 6749 要帶回 client。
func (s *Service) validateAuthorizeParams(input storytellerModel.OAuthAuthorizeRequest) *Error {
	if input.ResponseType != "code" {
		return newError(http.StatusBadRequest, "unsupported_response_type", "只支援 response_type=code")
	}
	if input.CodeChallengeMethod != "S256" || !pkcePattern.MatchString(input.CodeChallenge) {
		return invalidRequest("必須使用 PKCE（code_challenge_method=S256）")
	}
	if _, err := s.resolveResource(input.Resource); err != nil {
		return err
	}
	return nil
}

// resolveResource：沒帶 resource 就綁到預設的 MCP 網址；有帶就必須是我們的 MCP 網址（RFC 8707）。
func (s *Service) resolveResource(resource string) (string, *Error) {
	if resource == "" || strings.TrimRight(resource, "/") == s.Resource() {
		return s.Resource(), nil
	}
	return "", newError(http.StatusBadRequest, "invalid_target", "resource 不是這個服務的 MCP 網址")
}

// Preview 給授權頁在登入前就能顯示 client 名稱與跳轉網域。
func (s *Service) Preview(input storytellerModel.OAuthAuthorizeRequest) (*storytellerModel.OAuthAuthorizePreviewOutput, error) {
	client, err := s.resolveClient(input)
	if err != nil {
		return nil, err
	}
	output := &storytellerModel.OAuthAuthorizePreviewOutput{
		ClientID:     client.ClientID,
		ClientName:   displayName(client.ClientName, client.RedirectURIs),
		RedirectHost: redirectHost(input.RedirectURI),
	}
	if paramErr := s.validateAuthorizeParams(input); paramErr != nil {
		output.ErrorRedirectTo = s.redirectWith(input.RedirectURI, map[string]string{
			"error": paramErr.Code, "error_description": paramErr.Description, "state": input.State,
		})
	}
	return output, nil
}

// Authorize 處理使用者在授權頁按下「允許／拒絕」；允許時發授權碼並回傳帶 code 的跳轉網址。
// origin 會跟著授權碼存起來，grant 正式建立時拿來發安全通知。
func (s *Service) Authorize(userID uint64, input storytellerModel.OAuthAuthorizeRequest, origin notifyService.Origin) (*storytellerModel.OAuthAuthorizeOutput, error) {
	client, err := s.resolveClient(input)
	if err != nil {
		return nil, err
	}
	output := &storytellerModel.OAuthAuthorizeOutput{
		ClientID: client.ClientID, ClientName: displayName(client.ClientName, client.RedirectURIs),
	}
	if paramErr := s.validateAuthorizeParams(input); paramErr != nil {
		output.RedirectTo = s.redirectWith(input.RedirectURI, map[string]string{
			"error": paramErr.Code, "error_description": paramErr.Description, "state": input.State,
		})
		return output, nil
	}
	if !input.Approve {
		output.RedirectTo = s.redirectWith(input.RedirectURI, map[string]string{"error": "access_denied", "state": input.State})
		return output, nil
	}
	// 後端防線：前端 PenNameDialog 擋不住自己組 request 的情況
	profile, profileErr := s.repo.UserProfile(userID)
	if profileErr != nil {
		if repository.IsRecordNotFound(profileErr) {
			return nil, ErrPenNameRequired
		}
		return nil, profileErr
	}
	if strings.TrimSpace(profile.PenName) == "" {
		return nil, ErrPenNameRequired
	}
	code, genErr := randomToken(codePrefix, 32)
	if genErr != nil {
		return nil, genErr
	}
	resource, _ := s.resolveResource(input.Resource)
	if saveErr := s.codes.Save(code, authorizationCode{
		ClientID: client.ClientID, ClientDBID: client.ID, ClientName: output.ClientName, UserID: userID,
		RedirectURI: input.RedirectURI, CodeChallenge: input.CodeChallenge, Resource: resource, Origin: origin,
	}, codeTTL); saveErr != nil {
		return nil, saveErr
	}
	output.Approved = true
	output.RedirectTo = s.redirectWith(input.RedirectURI, map[string]string{"code": code, "state": input.State})
	return output, nil
}

// redirectWith 在 client 的 redirect_uri 後面補參數（保留原本的 query），並附上 iss（RFC 9207）。
func (s *Service) redirectWith(redirectURI string, params map[string]string) string {
	parsed, err := url.Parse(redirectURI)
	if err != nil {
		return redirectURI
	}
	query := parsed.Query()
	for key, value := range params {
		if value != "" {
			query.Set(key, value)
		}
	}
	query.Set("iss", s.issuer)
	parsed.RawQuery = query.Encode()
	return parsed.String()
}

// verifyPKCE：BASE64URL(SHA256(code_verifier)) 必須等於授權時的 code_challenge。
func verifyPKCE(verifier, challenge string) bool {
	if !pkcePattern.MatchString(verifier) {
		return false
	}
	sum := sha256.Sum256([]byte(verifier))
	expected := base64.RawURLEncoding.EncodeToString(sum[:])
	return subtle.ConstantTimeCompare([]byte(expected), []byte(challenge)) == 1
}
