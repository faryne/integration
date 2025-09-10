package config

import "github.com/Netflix/go-env"

type envConfig struct {
	AppPort     string `env:"APP_PORT,default=8080"`
	WalolitaDSN string `env:"WALOLITA_DSN"`
	RedisDSN    string `env:"REDIS_DSN"`
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
