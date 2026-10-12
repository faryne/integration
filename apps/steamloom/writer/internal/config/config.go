// Package config 集中 Writer 連線到 SteamLoom 的端點設定；預設指向正式站，
// 本機開發用環境變數覆寫（見 apps/steamloom/writer/README.md）。
package config

import (
	"cmp"
	"os"
	"strings"
)

type Config struct {
	// Issuer 是 OAuth authorization server，register／token／revoke 都在它底下
	Issuer string
	// AuthorizeURL 是授權頁；正式站是 {Issuer}/oauth/authorize，本機 SPA 在 vite 的 /storyteller/oauth/authorize
	AuthorizeURL string
	// APIBase 是 REST API 前綴，正式站走同源 /api（nginx 會去掉前綴轉給後端）
	APIBase string
	// SkillURL 是 Writer 啟動時檢查的 SteamLoom Skill 來源
	SkillURL string
}

func Load() Config {
	issuer := trim(cmp.Or(os.Getenv("STEAMLOOM_ISSUER"), "https://steamloom.works"))
	return Config{
		Issuer:       issuer,
		AuthorizeURL: trim(cmp.Or(os.Getenv("STEAMLOOM_AUTHORIZE_URL"), issuer+"/oauth/authorize")),
		APIBase:      trim(cmp.Or(os.Getenv("STEAMLOOM_API_BASE"), issuer+"/api")),
		SkillURL:     cmp.Or(os.Getenv("STEAMLOOM_SKILL_URL"), issuer+"/mcp/skill.md"),
	}
}

func trim(value string) string { return strings.TrimRight(value, "/") }
