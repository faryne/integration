package config

import (
	"strings"

	"github.com/Netflix/go-env"
)

type envConfig struct {
	AppEnvironment   string `env:"APP_ENV,default=development"`
	AppPort          string `env:"APP_PORT,default=8080"`
	WalolitaDSN      string `env:"WALOLITA_DSN"`
	WalolitaSlaveDSN string `env:"WALOLITA_SLAVE_DSN"`
	NekomaidDSN      string `env:"NEKOMAID_DSN"`
	RedisDSN         string `env:"REDIS_DSN"`
	ESDSN            string `env:"ES_DSN"`
	ChromePath       string `env:"CHROME_PATH"`
	FrontendPath     string `env:"FRONTEND_PATH" default:"https://beta.faryne.dev"`

	// AuditHotRetentionMonths 是稽核事件留在 MySQL 的月數；近期查詢只允許這個範圍內，
	// 更早的資料要走封存查詢（P4）。
	AuditHotRetentionMonths int `env:"AUDIT_HOT_RETENTION_MONTHS,default=3"`
	// 以下是稽核封存（P4）：S3 保存年數、bucket 與 Athena 設定。bucket 留空代表封存功能關閉，
	// 月匯出與清除排程會直接略過，封存查詢頁也不開放。
	// AWS 憑證優先用 AUDIT_AWS_ACCESS_KEY／SECRET；沒設就走 AWS 預設憑證鏈（例如 EC2 instance role）。
	AuditArchiveRetentionYears int    `env:"AUDIT_ARCHIVE_RETENTION_YEARS,default=7"`
	AuditArchiveBucket         string `env:"AUDIT_ARCHIVE_BUCKET"`
	AuditArchivePrefix         string `env:"AUDIT_ARCHIVE_PREFIX,default=audit"`
	AuditArchiveRegion         string `env:"AUDIT_ARCHIVE_REGION"`
	AuditArchiveMaxMonths      int    `env:"AUDIT_ARCHIVE_MAX_MONTHS,default=12"`
	AuditAthenaWorkgroup       string `env:"AUDIT_ATHENA_WORKGROUP"`
	AuditAthenaDatabase        string `env:"AUDIT_ATHENA_DATABASE"`
	AuditAthenaTable           string `env:"AUDIT_ATHENA_TABLE,default=storyteller_audit_events"`
	AuditAWSAccessKey          string `env:"AUDIT_AWS_ACCESS_KEY"`
	AuditAWSSecretKey          string `env:"AUDIT_AWS_SECRET_KEY"`

	// MaintenanceMode 手動維護開關；有設 MaintenanceStart／MaintenanceEnd 任一個時，
	// 改用時間區間判斷是否進維護模式，MaintenanceMode 這個值會被忽略。
	MaintenanceMode  bool   `env:"MAINTENANCE_MODE,default=false"`
	MaintenanceStart string `env:"MAINTENANCE_START"`
	MaintenanceEnd   string `env:"MAINTENANCE_END"`

	CFWorkerProxyURL    string `env:"CF_WORKER_PROXY_URL"`
	CFWorkerProxySecret string `env:"CF_WORKER_PROXY_SECRET"`

	GoogleCalendarCred string `env:"GOOGLE_CALENDAR_CRED"`
	FirebaseProjectID  string `env:"FIREBASE_PROJECT_ID"`
	// SteamLoom（storyteller）獨立的 Firebase 專案；留空時沿用 FIREBASE_PROJECT_ID（本機開發）
	StorytellerFirebaseProjectID string `env:"STORYTELLER_FIREBASE_PROJECT_ID"`
	YouTubeAPIKey                string `env:"YOUTUBE_API_KEY"`

	S3AccessKey string `env:"S3_ACCESS_KEY"`
	S3SecretKey string `env:"S3_SECRET_KEY"`
	S3Region    string `env:"S3_REGION"`
	S3Bucket    string `env:"S3_BUCKET"`
	CDNUrl      string `env:"CDN_URL"`

	NekomaidBucket           string `env:"NEKOMAID_BUCKET"`
	NekomaidTinamiKey        string `env:"NEKOMAID_TINAMI_KEY"`
	NekomaidS3Key            string `env:"NEKOMAID_S3_KEY"`
	NekomaidS3Secret         string `env:"NEKOMAID_S3_SECRET"`
	CloudFrontKeyPairID      string `env:"CLOUDFRONT_KEY_PAIR_ID"`
	CloudFrontPrivateKeyFile string `env:"CLOUDFRONT_PRIVATE_KEY_FILE"`
	PixivUsername            string `env:"PIXIV_USERNAME"`
	PixivPassword            string `env:"PIXIV_PASSWORD"`
	NicoEmail                string `env:"NICO_EMAIL"`
	NicoPassword             string `env:"NICO_PASSWORD"`

	FinMindToken   string `env:"FINMIND_TOKEN"`
	DiscordWebhook string `env:"DISCORD_WEBHOOK"`

	StorytellerAgentAPIKeyActiveKeyID string `env:"STORYTELLER_AGENT_API_KEY_ACTIVE_KEY_ID"`
	StorytellerAgentAPIKeyMasterKeys  string `env:"STORYTELLER_AGENT_API_KEY_MASTER_KEYS"`

	// StorytellerSearchIndex 沒設就沿用正式環境本來的名字，本機開發要另外測索引時
	// 才需要在 .env 蓋成不同名字，避免本機測試資料寫進正式環境共用的同一個 ES cluster。
	StorytellerSearchIndex string `env:"STORYTELLER_SEARCH_INDEX,default=storyteller_works"`

	// StorytellerCloudFrontKeyPairID／PrivateKeyFile 是 storyteller 圖像頁專用的簽名 key，
	// 跟共用的 CloudFrontKeyPairID（nekomaid 在用）分開，不共用私鑰。
	StorytellerCloudFrontKeyPairID      string `env:"STORYTELLER_CLOUDFRONT_KEY_PAIR_ID"`
	StorytellerCloudFrontPrivateKeyFile string `env:"STORYTELLER_CLOUDFRONT_PRIVATE_KEY_FILE"`

	// StorytellerOAuthIssuer 是 OAuth authorization server 的 issuer，也是 metadata、授權頁與
	// MCP resource（issuer + "/mcp"）的網址基底；只在 steamloom.works 開 OAuth，本機測試才覆寫。
	StorytellerOAuthIssuer string `env:"STORYTELLER_OAUTH_ISSUER,default=https://steamloom.works"`

	// StorytellerNotificationLockLimit 是每個使用者最多能鎖定幾則站內通知（鎖定的不會被
	// 180 天保留期清除）；調低只擋新的鎖定，既有鎖定不會被解除。
	StorytellerNotificationLockLimit int `env:"STORYTELLER_NOTIFICATION_LOCK_LIMIT,default=50"`

	// StorytellerAIAssistantEnabled 控制站內 AI 助理（agent chat、API key、Skill、用量報表、
	// 記憶草稿、AI 提案）是否開放。2026-10-03 起刻意停用：使用者多半已有 AI 訂閱，
	// 改以 MCP 為主要 AI 路徑；程式碼暫時保留，關閉時相關 API 一律回 403。
	// 前端對應常數為 STORYTELLER_AI_ASSISTANT_ENABLED（VITE_STORYTELLER_AI_ASSISTANT_ENABLED）。
	StorytellerAIAssistantEnabled bool `env:"STORYTELLER_AI_ASSISTANT_ENABLED,default=false"`

	// EnableDevAuthBypass 只給本機開發自動化測試用（例如 Claude Code 的瀏覽器工具
	// 需要免走 Firebase 登入彈窗、直接進工作台頁面）——開了才會註冊
	// `POST /auth/dev-session`，簽發固定測試帳號的合法 session，完全複用既有
	// authsession middleware／API，不影響任何其他路由。預設 false；千萬不要在
	// staging／正式環境的環境變數裡打開這個值。
	EnableDevAuthBypass bool `env:"ENABLE_DEV_AUTH_BYPASS,default=false"`
}

var loadEnvConfig envConfig

func InitEnvConfig() *env.EnvSet {
	e, err := env.UnmarshalFromEnviron(&loadEnvConfig)
	if err != nil {
		panic("Load config from environment failed: " + err.Error())
	}
	return &e
}

func EnvConfig() *envConfig {
	return &loadEnvConfig
}

// IsProduction 判斷是否為正式環境（APP_ENV=production 或 prod）；
// 會寫入正式外部資源的排程（例如稽核封存匯出）只在正式環境執行。
func (c *envConfig) IsProduction() bool {
	return strings.EqualFold(c.AppEnvironment, "production") || strings.EqualFold(c.AppEnvironment, "prod")
}
