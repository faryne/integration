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
	FrontendPath     string `env:"FRONTEND_PATH" default:"https://faryne.dev"`

	// CORSAllowOrigins 是一般 API 允許跨站呼叫的 origin（逗號分隔）；留空用 config/cors.go 的預設 prod 清單，
	// 設成 * 代表全開（CORS 收斂出事時的回滾開關）。MCP／OAuth 這類公開協定端點不受影響，一律 *。
	CORSAllowOrigins string `env:"CORS_ALLOW_ORIGINS"`

	// joyu.fyi 的 reCAPTCHA Enterprise（Google Fraud Defense）：女優上稿、影片修改送出前驗證 token。
	// JoyuRecaptchaKey 是 site key（前端也要一份：static_site 的 VITE_JOYU_RECAPTCHA_SITE_KEY）；
	// JoyuRecaptchaSecret 是 key 的 legacy secret，後端用它呼叫 siteverify 驗證，沒設就不驗證（見 service/recaptcha）
	// JoyuFirebaseProjectID joyu.fyi 登入用的 Firebase 專案（joyu-firebase）：後端只收這個專案簽發的 ID token
	JoyuFirebaseProjectID string  `env:"JOYU_FIREBASE_PROJECT_ID"`
	JoyuRecaptchaKey      string  `env:"JOYU_RECAPTCHA_KEY"`
	JoyuRecaptchaSecret   string  `env:"JOYU_RECAPTCHA_SECRET"`
	JoyuRecaptchaMinScore float64 `env:"JOYU_RECAPTCHA_MIN_SCORE,default=0.5"`

	// AMQPURL 是 AMQP 連線字串，目前用 CloudAMQP 代管的 LavinMQ（amqps://user:pass@host/vhost）；留空代表不啟用佇列
	AMQPURL string `env:"AMQP_URL"`

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

	// 共用寄信服務（service/mail）。MAIL_DRIVER：log（預設，只寫 log 不寄出，本機用）／ses。
	// prod 要寄真的信才設成 ses；之後換 Mailgun 等服務時在 service/mail 加 driver。
	MailDriver      string `env:"MAIL_DRIVER,default=log"`
	MailDefaultFrom string `env:"MAIL_DEFAULT_FROM"`
	// SES 跟 S3 共用 S3_ACCESS_KEY／S3_SECRET_KEY／S3_REGION（SES 權限直接掛在那把 key 上）；
	// configuration set 選填（追蹤退信／投訴用）
	SESConfigurationSet string `env:"SES_CONFIGURATION_SET"`

	// MaintenanceMode 手動維護開關；有設 MaintenanceStart／MaintenanceEnd 任一個時，
	// 改用時間區間判斷是否進維護模式，MaintenanceMode 這個值會被忽略。
	MaintenanceMode  bool   `env:"MAINTENANCE_MODE,default=false"`
	MaintenanceStart string `env:"MAINTENANCE_START"`
	MaintenanceEnd   string `env:"MAINTENANCE_END"`

	CFWorkerProxyURL    string `env:"CF_WORKER_PROXY_URL"`
	CFWorkerProxySecret string `env:"CF_WORKER_PROXY_SECRET"`

	FirebaseProjectID string `env:"FIREBASE_PROJECT_ID"`
	// SteamLoom（storyteller）獨立的 Firebase 專案；留空時沿用 FIREBASE_PROJECT_ID（本機開發）
	StorytellerFirebaseProjectID string `env:"STORYTELLER_FIREBASE_PROJECT_ID"`
	YouTubeAPIKey                string `env:"YOUTUBE_API_KEY"`
	// VTuber 直播行事曆：service account JSON 路徑（Firebase RTDB 與 Google Calendar 共用同一把）與 RTDB 網址；任一留空就不同步行事曆
	VtuberGoogleCredentials   string `env:"VTUBER_GOOGLE_CREDENTIALS"`
	VtuberFirebaseDatabaseURL string `env:"VTUBER_FIREBASE_DATABASE_URL"`
	// Apps Script 時代 Firebase 的 legacy database secret，只有 -cmd vtuber-import-calendars 用；匯入完就可以移除
	VtuberLegacyFirebaseSecret string `env:"VTUBER_LEGACY_FIREBASE_SECRET"`

	S3AccessKey string `env:"S3_ACCESS_KEY"`
	S3SecretKey string `env:"S3_SECRET_KEY"`
	S3Region    string `env:"S3_REGION"`
	S3Bucket    string `env:"S3_BUCKET"`
	CDNUrl      string `env:"CDN_URL"`

	NekomaidBucket    string `env:"NEKOMAID_BUCKET"`
	NekomaidTinamiKey string `env:"NEKOMAID_TINAMI_KEY"`
	NekomaidS3Key     string `env:"NEKOMAID_S3_KEY"`
	NekomaidS3Secret  string `env:"NEKOMAID_S3_SECRET"`
	// NekomaidIPHashSecret 版權申告查詢網址 /copyright-claim/:hash 的 IP 雜湊鑰匙（HMAC-SHA256）；
	// 不能留空：IPv4 只有 43 億種，沒有鑰匙的雜湊可以被暴力反推回 IP。換鑰匙會讓既有的查詢網址全部失效。
	NekomaidIPHashSecret string `env:"NEKOMAID_IP_HASH_SECRET"`
	// NekomaidFirebaseAPIKey neko 帳號用的 Firebase 專案 Web API Key：註冊、登入、寄信全部由後端打
	// Identity Toolkit REST API（不需要管理者金鑰，前端也不載入 Firebase 登入 SDK）
	NekomaidFirebaseAPIKey string `env:"NEKOMAID_FIREBASE_API_KEY"`
	// NekomaidAccountEnabled neko 帳號與我的追蹤的總開關：關閉時不註冊 /nekomaid/auth/*、/nekomaid/me/*，
	// 未驗證帳號清除排程也不跑。Firebase 動作網址設定不了（EMAIL_TEMPLATE_UPDATE_NOT_ALLOWED）之前先關著，
	// 禁抓與版權申告不受影響
	NekomaidAccountEnabled bool `env:"NEKOMAID_ACCOUNT_ENABLED,default=false"`
	// NekomaidFirebaseAuthEndpoint Identity Toolkit 的網址；本機用 Firebase Auth 模擬器時改成
	// http://localhost:9099/identitytoolkit.googleapis.com
	NekomaidFirebaseAuthEndpoint string `env:"NEKOMAID_FIREBASE_AUTH_ENDPOINT,default=https://identitytoolkit.googleapis.com"`
	CloudFrontKeyPairID          string `env:"CLOUDFRONT_KEY_PAIR_ID"`
	CloudFrontPrivateKeyFile     string `env:"CLOUDFRONT_PRIVATE_KEY_FILE"`
	PixivUsername                string `env:"PIXIV_USERNAME"`
	PixivPassword                string `env:"PIXIV_PASSWORD"`
	NicoEmail                    string `env:"NICO_EMAIL"`
	NicoPassword                 string `env:"NICO_PASSWORD"`

	FinMindToken   string `env:"FINMIND_TOKEN"`
	DiscordWebhook string `env:"DISCORD_WEBHOOK"`

	// Telegram bot：DMM 每日上架通知與同步失敗告警用
	TelegramBotToken string `env:"TG_BOT_TOKEN"`
	TelegramChatID   string `env:"TG_CHAT_ID"`

	// DMMVideoIndex 與 storyteller 一樣，本機跟正式環境共用 ES cluster，本機測試要蓋成別的名字
	DMMVideoIndex string `env:"DMM_VIDEO_INDEX,default=dmmvideos"`
	// DMMActressIndex 女優索引，理由同上：本機要測核准寫入時蓋成別的名字
	DMMActressIndex string `env:"DMM_ACTRESS_INDEX,default=dmmactresses"`

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
