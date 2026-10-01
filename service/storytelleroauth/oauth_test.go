package storytelleroauth

import (
	"crypto/sha256"
	"encoding/base64"
	"net/url"
	"strings"
	"testing"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/service/crypto"
	notifyService "faryne.dev/service/storytellernotify"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

// fakeRepo 用記憶體模擬 grant／client 表，只實作測試會走到的行為。
type fakeRepo struct {
	clients  []storytellerModel.OAuthClient
	grants   []storytellerModel.OAuthGrant
	penNames map[uint64]string
}

func (r *fakeRepo) CreateOAuthClient(row *storytellerModel.OAuthClient) error {
	row.ID = uint64(len(r.clients) + 1)
	r.clients = append(r.clients, *row)
	return nil
}

func (r *fakeRepo) OAuthClientByClientID(clientID string) (*storytellerModel.OAuthClient, error) {
	for _, row := range r.clients {
		if row.ClientID == clientID {
			return &row, nil
		}
	}
	return nil, gorm.ErrRecordNotFound
}

func (r *fakeRepo) DeleteUnusedOAuthClients(time.Time) (int64, error) { return 0, nil }

func (r *fakeRepo) CreateOAuthGrant(row *storytellerModel.OAuthGrant) error {
	row.ID = uint64(len(r.grants) + 1)
	r.grants = append(r.grants, *row)
	return nil
}

func (r *fakeRepo) find(match func(storytellerModel.OAuthGrant) bool) (*storytellerModel.OAuthGrantWithClient, error) {
	for _, row := range r.grants {
		if !row.IsDeleted && match(row) {
			client := r.clients[row.OAuthClientID-1]
			return &storytellerModel.OAuthGrantWithClient{OAuthGrant: row, ClientID: client.ClientID, ClientName: client.ClientName, RedirectURIs: client.RedirectURIs}, nil
		}
	}
	return nil, gorm.ErrRecordNotFound
}

func (r *fakeRepo) OAuthGrants(userID uint64) ([]storytellerModel.OAuthGrantWithClient, error) {
	rows := make([]storytellerModel.OAuthGrantWithClient, 0)
	for _, grant := range r.grants {
		if row, err := r.find(func(g storytellerModel.OAuthGrant) bool { return g.ID == grant.ID && g.UserID == userID }); err == nil {
			rows = append(rows, *row)
		}
	}
	return rows, nil
}

func (r *fakeRepo) OAuthGrantByPublicID(userID uint64, publicID string) (*storytellerModel.OAuthGrantWithClient, error) {
	return r.find(func(g storytellerModel.OAuthGrant) bool { return g.UserID == userID && g.PublicID == publicID })
}

func (r *fakeRepo) OAuthGrantByAccessHash(hash string) (*storytellerModel.OAuthGrantWithClient, error) {
	return r.find(func(g storytellerModel.OAuthGrant) bool { return g.AccessTokenHash == hash })
}

func (r *fakeRepo) OAuthGrantByRefreshHash(hash string) (*storytellerModel.OAuthGrantWithClient, error) {
	return r.find(func(g storytellerModel.OAuthGrant) bool { return g.RefreshTokenHash == hash })
}

func (r *fakeRepo) RotateOAuthGrantTokens(id uint64, oldHash string, next storytellerModel.OAuthGrant) (bool, error) {
	row := &r.grants[id-1]
	if row.IsDeleted || row.RefreshTokenHash != oldHash {
		return false, nil
	}
	row.AccessTokenHash, row.AccessExpiresAt, row.AccessTokenEncrypted = next.AccessTokenHash, next.AccessExpiresAt, next.AccessTokenEncrypted
	row.RefreshTokenHash, row.RefreshExpiresAt, row.PreviousRefreshTokenHash = next.RefreshTokenHash, next.RefreshExpiresAt, oldHash
	return true, nil
}

// OAuthGrantForRefreshAudit 跟正式 repository 一樣，連已撤銷、已輪替的 grant 都找得到。
func (r *fakeRepo) OAuthGrantForRefreshAudit(hash string) (*storytellerModel.OAuthGrantWithClient, error) {
	for _, row := range r.grants {
		if row.RefreshTokenHash == hash || row.PreviousRefreshTokenHash == hash {
			client := r.clients[row.OAuthClientID-1]
			return &storytellerModel.OAuthGrantWithClient{OAuthGrant: row, ClientID: client.ClientID, ClientName: client.ClientName, RedirectURIs: client.RedirectURIs}, nil
		}
	}
	return nil, gorm.ErrRecordNotFound
}

func (r *fakeRepo) DeleteOAuthGrant(id uint64) error {
	r.grants[id-1].IsDeleted = true
	return nil
}

func (r *fakeRepo) TouchOAuthGrantLastUsed(uint64) error { return nil }

func (r *fakeRepo) UserProfile(userID uint64) (*storytellerModel.UserProfile, error) {
	return &storytellerModel.UserProfile{ID: userID, PenName: r.penNames[userID]}, nil
}

type fakeCodes map[string]authorizationCode

func (c fakeCodes) Save(code string, payload authorizationCode, _ time.Duration) error {
	c[code] = payload
	return nil
}

func (c fakeCodes) Consume(code string) (*authorizationCode, error) {
	payload, ok := c[code]
	if !ok {
		return nil, nil
	}
	delete(c, code)
	return &payload, nil
}

type fakeLimiter struct{ allow bool }

func (l fakeLimiter) Allow(string, int64, time.Duration) (bool, error) { return l.allow, nil }

const (
	testIssuer   = "https://steamloom.test"
	testRedirect = "https://claude.ai/api/mcp/auth_callback"
	testVerifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk-test-verifier"
)

func newTestService(t *testing.T) (*Service, *fakeRepo) {
	t.Helper()
	repo := &fakeRepo{penNames: map[uint64]string{1: "霧港說書人"}}
	// 加密副本用明碼直接當 ciphertext，只驗證流程，不驗證加密本身（那在 service/crypto）
	return &Service{
		repo: repo, codes: fakeCodes{}, limiter: fakeLimiter{allow: true}, issuer: testIssuer, now: time.Now,
		seal: func(plaintext string) (*crypto.Envelope, error) { return &crypto.Envelope{Ciphertext: plaintext}, nil },
		open: func(envelope crypto.Envelope) (string, error) {
			if envelope.Ciphertext == "" {
				return "", crypto.ErrCiphertextInvalid
			}
			return envelope.Ciphertext, nil
		},
	}, repo
}

func challengeOf(verifier string) string {
	sum := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(sum[:])
}

func registerClient(t *testing.T, s *Service) string {
	t.Helper()
	out, err := s.Register("127.0.0.1", storytellerModel.OAuthClientRegistrationRequest{ClientName: "Claude", RedirectURIs: []string{testRedirect}})
	require.NoError(t, err)
	return out.ClientID
}

func authorizeRequest(clientID string) storytellerModel.OAuthAuthorizeRequest {
	return storytellerModel.OAuthAuthorizeRequest{
		ResponseType: "code", ClientID: clientID, RedirectURI: testRedirect, CodeChallenge: challengeOf(testVerifier),
		CodeChallengeMethod: "S256", State: "xyz", Approve: true,
	}
}

// codeFrom 從跳轉網址取出 code，順便確認 state 與 iss 有帶回去。
func codeFrom(t *testing.T, redirectTo string) string {
	t.Helper()
	parsed, err := url.Parse(redirectTo)
	require.NoError(t, err)
	require.Equal(t, "xyz", parsed.Query().Get("state"))
	require.Equal(t, testIssuer, parsed.Query().Get("iss"))
	return parsed.Query().Get("code")
}

func TestValidateRedirectURI(t *testing.T) {
	for uri, valid := range map[string]bool{
		"https://claude.ai/api/mcp/auth_callback":   true,
		"http://localhost:6274/callback":            true,
		"http://127.0.0.1:33418/cb":                 true,
		"cursor://anysphere.cursor-retrieval/oauth": true,
		"http://evil.example.com/cb":                false,
		"https://claude.ai/cb#frag":                 false,
		"javascript:alert(1)":                       false,
		"/relative/path":                            false,
	} {
		require.Equal(t, valid, validateRedirectURI(uri) == nil, uri)
	}
}

func TestRegisterRejectsSecretClientsAndRateLimit(t *testing.T) {
	s, _ := newTestService(t)
	_, err := s.Register("1.1.1.1", storytellerModel.OAuthClientRegistrationRequest{RedirectURIs: []string{testRedirect}, TokenEndpointAuthMethod: "client_secret_basic"})
	require.ErrorContains(t, err, "invalid_client_metadata")

	s.limiter = fakeLimiter{allow: false}
	_, err = s.Register("1.1.1.1", storytellerModel.OAuthClientRegistrationRequest{RedirectURIs: []string{testRedirect}})
	require.ErrorContains(t, err, "too_many_requests")
}

func TestPreviewDoesNotRedirectForUnknownClient(t *testing.T) {
	s, _ := newTestService(t)
	clientID := registerClient(t, s)

	_, err := s.Preview(storytellerModel.OAuthAuthorizeRequest{ClientID: clientID, RedirectURI: "https://evil.example.com/cb"})
	require.ErrorContains(t, err, "invalid_client")

	// client 正確但沒帶 PKCE：要把錯誤帶回 client，而不是在授權頁擋下
	preview, err := s.Preview(storytellerModel.OAuthAuthorizeRequest{ResponseType: "code", ClientID: clientID, RedirectURI: testRedirect, State: "xyz"})
	require.NoError(t, err)
	require.Equal(t, "Claude", preview.ClientName)
	require.Equal(t, "claude.ai", preview.RedirectHost)
	require.Contains(t, preview.ErrorRedirectTo, "error=invalid_request")
}

func TestAuthorizeRequiresPenNameAndHandlesDeny(t *testing.T) {
	s, repo := newTestService(t)
	clientID := registerClient(t, s)

	denied := authorizeRequest(clientID)
	denied.Approve = false
	out, err := s.Authorize(1, denied, notifyService.Origin{})
	require.NoError(t, err)
	require.False(t, out.Approved)
	require.Contains(t, out.RedirectTo, "error=access_denied")

	repo.penNames[2] = ""
	_, err = s.Authorize(2, authorizeRequest(clientID), notifyService.Origin{})
	require.ErrorIs(t, err, ErrPenNameRequired)
}

// grant 建立時要發安全通知，來源是按「允許」當下的瀏覽器，不是呼叫 token 端點的伺服器。
func TestGrantCreationNotifiesWithConsentOrigin(t *testing.T) {
	s, _ := newTestService(t)
	type sent struct {
		userID        uint64
		grant, client string
		origin        notifyService.Origin
	}
	var got []sent
	s.notifyAuthorized = func(userID uint64, grantPublicID, clientName string, origin notifyService.Origin) {
		got = append(got, sent{userID, grantPublicID, clientName, origin})
	}
	clientID := registerClient(t, s)
	consent := notifyService.Origin{Source: "web", IP: "1.163.0.1", UserAgent: "Mozilla/5.0 (Macintosh)"}
	out, err := s.Authorize(1, authorizeRequest(clientID), consent)
	require.NoError(t, err)
	result, err := s.Token(TokenRequest{GrantType: "authorization_code", Code: codeFrom(t, out.RedirectTo), ClientID: clientID, RedirectURI: testRedirect, CodeVerifier: testVerifier})
	require.NoError(t, err)
	require.Equal(t, []sent{{1, result.Audit.Grant.PublicID, "Claude", consent}}, got)

	// refresh 不是新的授權，不再通知
	s.now = func() time.Time { return time.Now().Add(accessTokenTTL + time.Hour) }
	_, err = s.Token(TokenRequest{GrantType: "refresh_token", RefreshToken: result.Output.RefreshToken, ClientID: clientID})
	require.NoError(t, err)
	require.Len(t, got, 1)
}

func TestFullFlowWithRefreshRotationAndRevoke(t *testing.T) {
	s, _ := newTestService(t)
	clientID := registerClient(t, s)

	out, err := s.Authorize(1, authorizeRequest(clientID), notifyService.Origin{})
	require.NoError(t, err)
	code := codeFrom(t, out.RedirectTo)

	exchange := TokenRequest{GrantType: "authorization_code", Code: code, ClientID: clientID, RedirectURI: testRedirect, CodeVerifier: testVerifier}
	result, err := s.Token(exchange)
	require.NoError(t, err)
	tokens := result.Output
	require.True(t, strings.HasPrefix(tokens.AccessToken, AccessTokenPrefix))
	require.Equal(t, int(accessTokenTTL.Seconds()), tokens.ExpiresIn)
	// 授權碼兌換記 oauth.grant.create，帶出新 grant
	require.Equal(t, auditGrantCreate, result.Audit.Action)
	require.Equal(t, uint64(1), result.Audit.Grant.UserID)
	require.Equal(t, "Claude", result.Audit.Grant.ClientName)
	grantID := result.Audit.Grant.PublicID
	require.True(t, strings.HasPrefix(grantID, grantIDPrefix))

	// 授權碼只能用一次
	_, err = s.Token(exchange)
	require.ErrorContains(t, err, "invalid_grant")

	auth, err := s.Authenticate(tokens.AccessToken)
	require.NoError(t, err)
	require.Equal(t, uint64(1), auth.UserID)
	require.Equal(t, "Claude", auth.Label)

	// access token 還在效期內就 refresh：拿回原本那組、expires_in 是剩餘時間、不記稽核
	refreshRequest := TokenRequest{GrantType: "refresh_token", RefreshToken: tokens.RefreshToken, ClientID: clientID}
	s.now = func() time.Time { return time.Now().Add(time.Hour) }
	early, err := s.Token(refreshRequest)
	require.NoError(t, err)
	require.Nil(t, early.Audit)
	require.Equal(t, tokens.AccessToken, early.Output.AccessToken)
	require.Equal(t, tokens.RefreshToken, early.Output.RefreshToken)
	require.Less(t, early.Output.ExpiresIn, tokens.ExpiresIn)

	// access token 過期後 refresh：換發新的一組並記 oauth.token.refresh，舊的 access／refresh 都失效
	s.now = func() time.Time { return time.Now().Add(accessTokenTTL + time.Minute) }
	rotated, err := s.Token(refreshRequest)
	require.NoError(t, err)
	require.Equal(t, auditTokenRefresh, rotated.Audit.Action)
	require.Equal(t, grantID, rotated.Audit.Grant.PublicID)
	refreshed := rotated.Output
	require.NotEqual(t, tokens.AccessToken, refreshed.AccessToken)
	s.now = time.Now
	_, err = s.Authenticate(tokens.AccessToken)
	require.Error(t, err)

	// 拿已輪替掉的 refresh token 再換：拒絕，並記在同一個 grant 名下（reason=reused）
	reused, err := s.Token(refreshRequest)
	require.ErrorContains(t, err, "invalid_grant")
	require.Equal(t, auditRefreshDenied, reused.Audit.Action)
	require.Equal(t, "reused", reused.Audit.Reason)
	require.Equal(t, grantID, reused.Audit.Grant.PublicID)

	revoked, err := s.Revoke(refreshed.RefreshToken)
	require.NoError(t, err)
	require.Equal(t, grantID, revoked.PublicID)
	_, err = s.Authenticate(refreshed.AccessToken)
	require.Error(t, err)
	// 已撤銷的 refresh token 再拿來換：拒絕並記 reason=revoked
	afterRevoke, err := s.Token(TokenRequest{GrantType: "refresh_token", RefreshToken: refreshed.RefreshToken, ClientID: clientID})
	require.ErrorContains(t, err, "invalid_grant")
	require.Equal(t, "revoked", afterRevoke.Audit.Reason)
	// 已撤銷或不存在的 token 撤銷時不回錯，也不帶 grant
	revoked, err = s.Revoke(refreshed.RefreshToken)
	require.NoError(t, err)
	require.Nil(t, revoked)
	// 完全陌生的 refresh token：拒絕但不記稽核（對不到任何使用者）
	unknown, err := s.Token(TokenRequest{GrantType: "refresh_token", RefreshToken: "str_unknown", ClientID: clientID})
	require.ErrorContains(t, err, "invalid_grant")
	require.Nil(t, unknown)
}

func TestExchangeRejectsWrongVerifierAndBurnsCode(t *testing.T) {
	s, _ := newTestService(t)
	clientID := registerClient(t, s)
	out, err := s.Authorize(1, authorizeRequest(clientID), notifyService.Origin{})
	require.NoError(t, err)
	code := codeFrom(t, out.RedirectTo)

	wrong := TokenRequest{GrantType: "authorization_code", Code: code, ClientID: clientID, RedirectURI: testRedirect, CodeVerifier: strings.Repeat("a", 43)}
	_, err = s.Token(wrong)
	require.ErrorContains(t, err, "code_verifier")

	// 驗證失敗也已經消耗掉授權碼，換對的 verifier 也不能再用
	wrong.CodeVerifier = testVerifier
	_, err = s.Token(wrong)
	require.ErrorContains(t, err, "invalid_grant")
}

func TestExpiredAccessTokenReportsReason(t *testing.T) {
	s, _ := newTestService(t)
	clientID := registerClient(t, s)
	out, err := s.Authorize(1, authorizeRequest(clientID), notifyService.Origin{})
	require.NoError(t, err)
	result, err := s.Token(TokenRequest{GrantType: "authorization_code", Code: codeFrom(t, out.RedirectTo), ClientID: clientID, RedirectURI: testRedirect, CodeVerifier: testVerifier})
	require.NoError(t, err)
	tokens := result.Output

	s.now = func() time.Time { return time.Now().Add(2 * accessTokenTTL) }
	auth, err := s.Authenticate(tokens.AccessToken)
	require.Error(t, err)
	require.Equal(t, "expired", auth.DeniedReason)
}

func TestResourceMustMatchMCPEndpoint(t *testing.T) {
	s, _ := newTestService(t)
	clientID := registerClient(t, s)
	request := authorizeRequest(clientID)
	request.Resource = "https://other.example.com/mcp"
	out, err := s.Authorize(1, request, notifyService.Origin{})
	require.NoError(t, err)
	require.False(t, out.Approved)
	require.Contains(t, out.RedirectTo, "error=invalid_target")
}
