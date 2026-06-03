package sns

import (
	"fmt"
	"html/template"
	"net/url"
	"path"
	"regexp"
	"strings"

	"faryne.dev/config"
	modelSNS "faryne.dev/model/entity/sns"
	"faryne.dev/service/twse"
)

const (
	siteName           = "ha2.tw / faryne.dev"
	defaultFrontendURL = "https://beta.faryne.dev"
	defaultDescription = "Faryne 的個人實驗室，整理開放資料、ETF 與匯率工具、爬蟲工具、Threads 截圖工具，以及一些 side project。"
	defaultImagePath   = "/faryne-icon-1024.jpg"
)

type pathMeta struct {
	Path        string
	Pattern     *regexp.Regexp
	Title       string
	Description string
	Prefix      bool
	Apply       func(meta *modelSNS.Meta, matches []string)
}

var pathCollection = []pathMeta{
	{
		Pattern:     regexp.MustCompile(`^/data/etf/twse/([0-9A-Za-z_-]+)$`),
		Title:       "ETF 投資導航",
		Description: "整理台股 ETF 除息、填息與歷史統計資料的投資輔助工具。",
		Apply: func(meta *modelSNS.Meta, matches []string) {
			applyTwseETFMeta(meta, strings.ToUpper(matches[1]))
		},
	},
	{Path: "/", Title: siteName, Description: defaultDescription},
	{Path: "/av/video", Title: "AV 影片搜尋", Description: "以番號、標籤、演員與片名搜尋影片資料的整理工具。", Prefix: true},
	{Path: "/av/actress", Title: "AV 女優搜尋", Description: "搜尋演員資料與作品索引的整理工具。", Prefix: true},
	{Path: "/data/tw-stats", Title: "台灣指標", Description: "查詢台灣公開統計指標，快速瀏覽資料趨勢與歷史紀錄。", Prefix: true},
	{Path: "/data/rates", Title: "匯率", Description: "查詢主要貨幣匯率，並提供簡單的匯率換算工具。"},
	{Path: "/data/fire/realtime", Title: "即時消防出勤記錄", Description: "整理即時消防出勤公開資料，方便快速瀏覽事件列表。"},
	{Path: "/data/etf/yieldmax", Title: "YieldMax ETF 配息統計", Description: "整理 YieldMax ETF 配息資料、歷史紀錄與分割資訊。"},
	{Path: "/data/etf/twse", Title: "ETF 投資導航", Description: "整理台股 ETF 除息、填息與歷史統計資料的投資輔助工具。"},
	{Path: "/tools/crawler", Title: "爬蟲工具", Description: "以規則設定方式測試網頁資料擷取結果的工具。"},
	{Path: "/tools/thread/capture", Title: "Threads 截圖工具", Description: "將 Threads 貼文轉成適合保存與分享的截圖。"},
	{Path: "/tools/webshot", Title: "網站截圖工具", Description: "產生網站完整頁面截圖、縮圖與歷史紀錄連結，方便保存網頁狀態。", Prefix: true},
	{Path: "/tools/userscripts", Title: "Userscripts 列表", Description: "整理 Faryne 維護或使用中的 userscripts 工具列表。"},
}

func RenderHTML(req modelSNS.RenderRequest) (string, error) {
	meta := BuildMeta(req)
	var out strings.Builder
	if err := htmlTemplate.Execute(&out, meta); err != nil {
		return "", err
	}
	return out.String(), nil
}

func BuildMeta(req modelSNS.RenderRequest) modelSNS.Meta {
	frontendOrigin := frontendOrigin()
	frontendPath := normalizeFrontendPath(req.Path)
	canonical := withQuery(absoluteURL(frontendOrigin, frontendPath), req.Query)
	openGraphURL := withQuery(absoluteURL(frontendOrigin, "/sns"+frontendPath), req.Query)

	meta := modelSNS.Meta{
		Title:        siteName,
		Description:  defaultDescription,
		Canonical:    canonical,
		OpenGraphURL: openGraphURL,
		Image:        absoluteURL(frontendOrigin, defaultImagePath),
		Robots:       "index, follow",
		Type:         "website",
		RedirectURL:  canonical,
	}

	if matched, matches, ok := matchPathMeta(frontendPath); ok {
		meta.Title = fullTitle(matched.Title)
		meta.Description = matched.Description
		if matched.Apply != nil {
			matched.Apply(&meta, matches)
		}
	}

	return meta
}

func applyTwseETFMeta(meta *modelSNS.Meta, code string) {
	meta.Title = fullTitle(fmt.Sprintf("%s ETF 投資導航", code))
	meta.Description = fmt.Sprintf("查看 %s 的台股 ETF 除息、填息勝率、均線與歷史統計資料。", code)

	row, err := twse.GetHistoryDivByCode(code)
	if err != nil {
		return
	}

	name := strings.TrimSpace(row.ETF.Name)
	if name == "" {
		return
	}

	meta.Title = fullTitle(fmt.Sprintf("%s %s", row.ETF.Code, name))
	parts := []string{fmt.Sprintf("%s %s 的台股 ETF 除息、填息與技術統計", row.ETF.Code, name)}
	if row.ETF.Share > 0 {
		parts = append(parts, fmt.Sprintf("最近配息 %.4f 元", row.ETF.Share))
	}
	if row.ETF.WinRate > 0 || row.ETF.TotalExCount > 0 {
		parts = append(parts, fmt.Sprintf("歷史填息勝率 %.2f%%", row.ETF.WinRate))
	}
	if row.ETF.LatestClose > 0 {
		parts = append(parts, fmt.Sprintf("最新收盤價 %.2f 元", row.ETF.LatestClose))
	}
	meta.Description = strings.Join(parts, "，") + "。"
}

func matchPathMeta(frontendPath string) (pathMeta, []string, bool) {
	for _, route := range pathCollection {
		if route.Pattern != nil {
			if matches := route.Pattern.FindStringSubmatch(frontendPath); len(matches) > 0 {
				return route, matches, true
			}
			continue
		}

		if route.Path == frontendPath || (route.Prefix && route.Path != "/" && strings.HasPrefix(frontendPath, route.Path+"/")) {
			return route, nil, true
		}
	}

	return pathMeta{}, nil, false
}

func fullTitle(page string) string {
	page = strings.TrimSpace(page)
	if page == "" || page == siteName {
		return siteName
	}
	return page + " | " + siteName
}

func frontendOrigin() string {
	origin := strings.TrimRight(config.EnvConfig().FrontendPath, "/")
	if origin == "" {
		return defaultFrontendURL
	}
	return origin
}

func normalizeFrontendPath(value string) string {
	value = strings.TrimSpace(value)
	value = strings.ReplaceAll(value, "\\", "/")
	value = strings.TrimPrefix(value, "/sns")
	if value == "" || strings.Contains(value, "://") || strings.HasPrefix(value, "//") {
		return "/"
	}
	if !strings.HasPrefix(value, "/") {
		value = "/" + value
	}
	cleaned := path.Clean(value)
	if cleaned == "." || cleaned == "/." {
		return "/"
	}
	return cleaned
}

func absoluteURL(origin string, targetPath string) string {
	base, err := url.Parse(origin)
	if err != nil {
		return defaultFrontendURL + targetPath
	}
	ref := &url.URL{Path: targetPath}
	return base.ResolveReference(ref).String()
}

func withQuery(target string, query string) string {
	query = strings.TrimPrefix(strings.TrimSpace(query), "?")
	if query == "" {
		return target
	}
	parsed, err := url.Parse(target)
	if err != nil {
		return target
	}
	parsed.RawQuery = query
	return parsed.String()
}

var htmlTemplate = template.Must(template.New("sns").Parse(`<!doctype html>
<html lang="zh-Hant-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>{{ .Title }}</title>
  <link rel="canonical" href="{{ .Canonical }}">
  <meta name="description" content="{{ .Description }}">
  <meta name="robots" content="{{ .Robots }}">
  <meta name="theme-color" content="#1976d2">
  <meta property="og:type" content="{{ .Type }}">
  <meta property="og:site_name" content="` + siteName + `">
  <meta property="og:locale" content="zh_TW">
  <meta property="og:title" content="{{ .Title }}">
  <meta property="og:description" content="{{ .Description }}">
  <meta property="og:url" content="{{ .OpenGraphURL }}">
  <meta property="og:image" content="{{ .Image }}">
  <meta property="og:image:alt" content="` + siteName + `">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="{{ .Title }}">
  <meta name="twitter:description" content="{{ .Description }}">
  <meta name="twitter:image" content="{{ .Image }}">
  <script type="application/ld+json">{
    "@context":"https://schema.org",
    "@type":"WebPage",
    "name":{{ .Title | printf "%q" }},
    "url":{{ .Canonical | printf "%q" }},
    "description":{{ .Description | printf "%q" }},
    "inLanguage":"zh-Hant-TW",
    "isPartOf":{"@type":"WebSite","name":"` + siteName + `","url":"` + defaultFrontendURL + `"}
  }</script>
</head>
<body>
  <main>
    <h1>{{ .Title }}</h1>
    <p>{{ .Description }}</p>
    <p><a href="{{ .RedirectURL }}">前往頁面</a></p>
  </main>
  <script>location.replace({{ .RedirectURL }});</script>
</body>
</html>`))
