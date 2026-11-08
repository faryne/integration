package sns

import "strings"

// joyu.fyi（AV 女優資料站）：AV 頁面從 faryne.dev/av/* 搬到獨立網域，網址拿掉 /av 前綴，女優列表當首頁。
// nginx 把 joyu.fyi 的爬蟲請求轉給後端時會補上 /av 前綴（同 steamloom 補 /storyteller），
// 所以 pathCollection 裡的 /av/* 規則不用改；這裡負責把 canonical／站名／預覽圖換成 joyu 自己的。
const (
	joyuSiteName = "joyu.fyi"
	joyuOrigin   = "https://joyu.fyi"
	// joyuDescription 跟前端 static_site/src/data/siteBranding.ts 同一句，改的時候兩邊一起改
	joyuDescription      = "整理 AV 女優資料與作品索引：用名字、別名、主題找女優，查看出演作品與番號。"
	joyuDefaultImagePath = "/joyu-og-default.jpg"
	avPathPrefix         = "/av"
)

func isJoyuHost(host string) bool {
	host = strings.ToLower(strings.TrimSpace(host))
	return host == "joyu.fyi" || host == "www.joyu.fyi"
}

// isAvPath 判斷是不是 AV 頁面（nginx 轉 joyu.fyi 時補上的 /av 前綴，或舊的 faryne.dev/av/*）
func isAvPath(frontendPath string) bool {
	return frontendPath == avPathPrefix || strings.HasPrefix(frontendPath, avPathPrefix+"/")
}

// joyuPublicPath 把帶 /av 前綴的前端路徑換成 joyu.fyi 上的真實網址：/av/video/X → /video/X；
// 女優列表（/av、/av/actress）是首頁
func joyuPublicPath(frontendPath string) string {
	publicPath := strings.TrimPrefix(frontendPath, avPathPrefix)
	if publicPath == "" || publicPath == "/actress" {
		return "/"
	}
	return publicPath
}

// JoyuRobotsTxt joyu.fyi 的 robots.txt：API 不給爬；sitemap 等女優數量規劃好（可能要拆 sitemap index）再補
func JoyuRobotsTxt() string {
	return strings.Join([]string{
		"User-agent: *",
		"Allow: /",
		"Disallow: /api/",
		"",
	}, "\n")
}
