// Package config 集中 Writer 連線到 SteamLoom 的端點設定；預設指向正式站，
// 本機開發用環境變數覆寫（見 apps/steamloom/writer/README.md）。
package config

import (
	"cmp"
	"net/url"
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
	// WebURL 是網站前端的 origin（「在網站上開啟」、公開網址預覽用）。正式站就是 steamloom.works；
	// 本機開發時網站在 vite（localhost:5174），跟後端 Issuer（localhost:8080）不同，所以不能直接用 Issuer。
	WebURL string
}

func Load() Config {
	issuer := trim(cmp.Or(os.Getenv("STEAMLOOM_ISSUER"), "https://steamloom.works"))
	authorizeURL := trim(cmp.Or(os.Getenv("STEAMLOOM_AUTHORIZE_URL"), issuer+"/oauth/authorize"))
	return Config{
		Issuer:       issuer,
		AuthorizeURL: authorizeURL,
		APIBase:      trim(cmp.Or(os.Getenv("STEAMLOOM_API_BASE"), issuer+"/api")),
		SkillURL:     cmp.Or(os.Getenv("STEAMLOOM_SKILL_URL"), issuer+"/mcp/skill.md"),
		// 沒指定就取授權頁的 origin：授權頁本來就是網站前端的頁面，本機與正式站都對得上
		WebURL: trim(cmp.Or(os.Getenv("STEAMLOOM_WEB_URL"), originOf(authorizeURL), issuer)),
	}
}

// originOf 取網址的 scheme://host；解析失敗回空字串，由呼叫端退回下一個候選值
func originOf(raw string) string {
	parsed, err := url.Parse(raw)
	if err != nil || parsed.Scheme == "" || parsed.Host == "" {
		return ""
	}
	return parsed.Scheme + "://" + parsed.Host
}

func trim(value string) string { return strings.TrimRight(value, "/") }
