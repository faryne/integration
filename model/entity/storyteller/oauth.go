package storyteller

import "time"

// OAuthClient 是透過 Dynamic Client Registration（RFC 7591）匿名註冊的 public client，
// 不綁使用者；client_name 由對方自行填寫，只能當顯示用，不能當身分依據。
type OAuthClient struct {
	ID           uint64    `gorm:"column:id;primaryKey"`
	ClientID     string    `gorm:"column:client_id"`
	ClientName   string    `gorm:"column:client_name"`
	RedirectURIs string    `gorm:"column:redirect_uris"`
	CreatedAt    time.Time `gorm:"column:created_at"`
	UpdatedAt    time.Time `gorm:"column:updated_at"`
}

func (OAuthClient) TableName() string { return "storyteller_oauth_clients" }

// OAuthGrant 是「使用者 × client 的一次授權」，同時保存目前有效的 access／refresh token
// 雜湊；refresh 時兩者一起換新，撤銷（soft delete）後底下 token 全部失效。
type OAuthGrant struct {
	ID              uint64    `gorm:"column:id;primaryKey"`
	PublicID        string    `gorm:"column:public_id"`
	UserID          uint64    `gorm:"column:user_id"`
	OAuthClientID   uint64    `gorm:"column:oauth_client_id"`
	Resource        string    `gorm:"column:resource"`
	AccessTokenHash string    `gorm:"column:access_token_hash"`
	AccessExpiresAt time.Time `gorm:"column:access_expires_at"`
	// 目前 access token 的加密副本（crypto.Envelope 三欄）；效期內提早 refresh 時解開回傳原本那支
	AccessTokenEncrypted string    `gorm:"column:access_token_encrypted"`
	AccessTokenDataKey   string    `gorm:"column:access_token_data_key"`
	AccessTokenKeyID     string    `gorm:"column:access_token_key_id"`
	RefreshTokenHash     string    `gorm:"column:refresh_token_hash"`
	RefreshExpiresAt     time.Time `gorm:"column:refresh_expires_at"`
	// 上一次輪替掉的 refresh token 雜湊，只用來辨識「拿舊 refresh token 來換」並記稽核
	PreviousRefreshTokenHash string     `gorm:"column:previous_refresh_token_hash"`
	LastUsedAt               *time.Time `gorm:"column:last_used_at"`
	IsDeleted                bool       `gorm:"column:is_deleted"`
	DeletedAt                *time.Time `gorm:"column:deleted_at"`
	CreatedAt                time.Time  `gorm:"column:created_at"`
	UpdatedAt                time.Time  `gorm:"column:updated_at"`
}

func (OAuthGrant) TableName() string { return "storyteller_oauth_grants" }

// OAuthGrantWithClient 是列表與 bearer 驗證用的 join 結果，順便帶出 client 顯示資訊。
type OAuthGrantWithClient struct {
	OAuthGrant
	ClientID     string `gorm:"column:client_id"`
	ClientName   string `gorm:"column:client_name"`
	RedirectURIs string `gorm:"column:redirect_uris"`
}

// OAuthClientRegistrationRequest 只取 MCP client 實際會送的 RFC 7591 欄位，其餘忽略。
type OAuthClientRegistrationRequest struct {
	ClientName              string   `json:"client_name"`
	RedirectURIs            []string `json:"redirect_uris"`
	TokenEndpointAuthMethod string   `json:"token_endpoint_auth_method"`
	GrantTypes              []string `json:"grant_types"`
	ResponseTypes           []string `json:"response_types"`
}

type OAuthClientRegistrationOutput struct {
	ClientID                string   `json:"client_id"`
	ClientIDIssuedAt        int64    `json:"client_id_issued_at"`
	ClientName              string   `json:"client_name,omitempty"`
	RedirectURIs            []string `json:"redirect_uris"`
	GrantTypes              []string `json:"grant_types"`
	ResponseTypes           []string `json:"response_types"`
	TokenEndpointAuthMethod string   `json:"token_endpoint_auth_method"`
}

// OAuthAuthorizeRequest 是授權頁帶進來的 query（preview）與使用者按下允許／拒絕後送出的
// body（approve）共用的參數；Approve 只在 approve 時有意義。
type OAuthAuthorizeRequest struct {
	ResponseType        string `json:"response_type" query:"response_type"`
	ClientID            string `json:"client_id" query:"client_id"`
	RedirectURI         string `json:"redirect_uri" query:"redirect_uri"`
	CodeChallenge       string `json:"code_challenge" query:"code_challenge"`
	CodeChallengeMethod string `json:"code_challenge_method" query:"code_challenge_method"`
	State               string `json:"state" query:"state"`
	Resource            string `json:"resource" query:"resource"`
	Approve             bool   `json:"approve"`
}

// OAuthAuthorizePreviewOutput 給授權頁顯示用；ErrorRedirectTo 不為空代表 client 與 redirect_uri
// 驗證通過、但其他參數有誤，依 RFC 6749 要把錯誤帶回 client，前端直接跳轉即可。
type OAuthAuthorizePreviewOutput struct {
	ClientID        string `json:"client_id"`
	ClientName      string `json:"client_name"`
	RedirectHost    string `json:"redirect_host"`
	ErrorRedirectTo string `json:"error_redirect_to,omitempty"`
}

// OAuthAuthorizeOutput 只回跳轉網址；授權碼只存在網址裡，不另外放欄位，避免被稽核摘要撿走。
type OAuthAuthorizeOutput struct {
	ClientID   string `json:"client_id"`
	ClientName string `json:"client_name"`
	Approved   bool   `json:"approved"`
	RedirectTo string `json:"redirect_to"`
}

type OAuthTokenOutput struct {
	AccessToken  string `json:"access_token"`
	TokenType    string `json:"token_type"`
	ExpiresIn    int    `json:"expires_in"`
	RefreshToken string `json:"refresh_token"`
}

// OAuthGrantOutput 是「開發者 › OAuth Token」頁的每一列。
type OAuthGrantOutput struct {
	PublicID         string     `json:"public_id"`
	ClientName       string     `json:"client_name"`
	RedirectHost     string     `json:"redirect_host"`
	LastUsedAt       *time.Time `json:"last_used_at"`
	RefreshExpiresAt time.Time  `json:"refresh_expires_at"`
	CreatedAt        time.Time  `json:"created_at"`
}
