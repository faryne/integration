package config

import "strings"

// defaultCORSAllowOrigins 是 CORS_ALLOW_ORIGINS 沒設時的白名單：自家各網域，加上各站 Firebase Hosting
// 的預設網域（*.web.app 關不掉，實際觀察到有人直接開 nekomaid.web.app）。
// 來源統計見 DevelopDocuments/api_domain/API網域整合_2026-11-04.md 的「Origin 觀察紀錄」。
var defaultCORSAllowOrigins = []string{
	"https://faryne.dev",
	"https://www.faryne.dev",
	"https://beta.faryne.dev",
	"https://galgame.tv",
	"https://www.galgame.tv",
	"https://neko.maid.tw",
	"https://steamloom.works",
	"https://www.steamloom.works",
	"https://faryne-integration.web.app",
	"https://galgame-tv.web.app",
	"https://nekomaid.web.app",
	"https://steamloom-web.web.app",
}

// CORSOrigins 回傳一般 API 的 CORS 白名單；回傳 ["*"] 代表全開。
func (c *envConfig) CORSOrigins() []string {
	if strings.TrimSpace(c.CORSAllowOrigins) == "" {
		return defaultCORSAllowOrigins
	}
	var origins []string
	for _, o := range strings.Split(c.CORSAllowOrigins, ",") {
		// 容許尾端多打斜線（https://faryne.dev/），Origin header 本身不會帶
		if o = strings.ToLower(strings.TrimRight(strings.TrimSpace(o), "/")); o != "" {
			origins = append(origins, o)
		}
	}
	return origins
}
