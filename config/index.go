package config

import "github.com/Netflix/go-env"

type envConfig struct {
	AppPort      string `env:"APP_PORT,default=8080"`
	WalolitaDSN  string `env:"WALOLITA_DSN"`
	NekomaidDSN  string `env:"NEKOMAID_DSN"`
	RedisDSN     string `env:"REDIS_DSN"`
	ESDSN        string `env:"ES_DSN"`
	ChromePath   string `env:"CHROME_PATH"`
	FrontendPath string `env:"FRONTEND_PATH" default:"https://beta.faryne.dev"`

	GoogleCalendarCred string `env:"GOOGLE_CALENDAR_CRED"`

	S3AccessKey string `env:"S3_ACCESS_KEY"`
	S3SecretKey string `env:"S3_SECRET_KEY"`
	S3Region    string `env:"S3_REGION"`
	S3Bucket    string `env:"S3_BUCKET"`
	CDNUrl      string `env:"CDN_URL"`

	NekomaidBucket    string `env:"NEKOMAID_BUCKET"`
	NekomaidTinamiKey string `env:"NEKOMAID_TINAMI_KEY"`
	NekomaidS3Key     string `env:"NEKOMAID_S3_KEY"`
	NekomaidS3Secret  string `env:"NEKOMAID_S3_SECRET"`
	PixivUsername     string `env:"PIXIV_USERNAME"`
	PixivPassword     string `env:"PIXIV_PASSWORD"`
	NicoEmail         string `env:"NICO_EMAIL"`
	NicoPassword      string `env:"NICO_PASSWORD"`

	FinMindToken   string `env:"FINMIND_TOKEN"`
	DiscordWebhook string `env:"DISCORD_WEBHOOK"`
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
