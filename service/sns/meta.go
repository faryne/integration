package sns

import (
	"encoding/json"
	"fmt"
	"html/template"
	"net/http"
	"net/url"
	"path"
	"regexp"
	"strings"
	"time"

	"faryne.dev/config"
	modelSNS "faryne.dev/model/entity/sns"
	"faryne.dev/model/enum"
	"faryne.dev/service/client"
	"faryne.dev/service/twse"
)

const (
	siteName            = "ha2.tw / faryne.dev"
	nekomaidSiteName    = "難以名狀的抓圖器"
	defaultFrontendURL  = "https://beta.faryne.dev"
	defaultDescription  = "Faryne 的個人實驗室，整理開放資料、ETF 與匯率工具、爬蟲工具、Threads 截圖工具，以及一些 side project。"
	nekomaidDescription = "搜尋與瀏覽難以名狀的抓圖器收錄的 Pixiv、Niconico 靜畫與 TINAMI 作品索引。"
	defaultImagePath    = "/faryne-icon-1024.jpg"
	nekomaidAPIBase     = "https://faryne.dev/api/opendata/nekomaid"
)

type pathMeta struct {
	Path        string
	Pattern     *regexp.Regexp
	Title       string
	SiteName    string
	Description string
	Image       string
	Prefix      bool
	Apply       func(meta *modelSNS.Meta, matches []string)
}

type nekomaidArtworkAPIResponse struct {
	Artwork nekomaidArtworkMeta `json:"artwork"`
	Item    nekomaidArtworkMeta `json:"item"`
	Illust  nekomaidArtworkMeta `json:"illust"`
	Author  struct {
		Nickname string `json:"nickname"`
		Author   string `json:"author"`
	} `json:"author"`
	Recommendations []nekomaidArtworkMeta `json:"recommendations"`
}

type nekomaidArtworkMeta struct {
	Site      string   `json:"site"`
	From      string   `json:"from"`
	AuthorID  any      `json:"author_id"`
	ArtworkID string   `json:"artwork_id"`
	Title     string   `json:"title"`
	Tags      []string `json:"tags"`
	Thumb     string   `json:"thumb"`
	IsR18     any      `json:"is_r18"`
	R18       bool     `json:"r18"`
	Photos    []struct {
		URL string `json:"url"`
	} `json:"photos"`
}

var fetchNekomaidArtworkMeta = fetchNekomaidArtworkMetaFromAPI

var pathCollection = []pathMeta{
	{
		Pattern:     regexp.MustCompile(`^/(pixiv|nico|tinami)(?:/([^/]+))?(?:/([^/]+))?$`),
		Title:       nekomaidSiteName,
		SiteName:    nekomaidSiteName,
		Description: nekomaidDescription,
		Apply:       applyLegacyNekomaidMeta,
	},
	{
		Pattern:     regexp.MustCompile(`^/nekomaid/(pixiv|nico|tinami)/([^/]+)/([^/]+)$`),
		Title:       nekomaidSiteName,
		SiteName:    nekomaidSiteName,
		Description: nekomaidDescription,
		Apply:       applyNekomaidArtworkMetaFromMatches,
	},
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
	{Path: "/nekomaid", Title: nekomaidSiteName, SiteName: nekomaidSiteName, Description: nekomaidDescription, Prefix: true},
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
	cleanQuery := stripTrackingQuery(req.Query)
	canonical := withQuery(absoluteURL(frontendOrigin, frontendPath), cleanQuery)
	openGraphURL := withQuery(absoluteURL(frontendOrigin, "/sns"+frontendPath), cleanQuery)

	meta := modelSNS.Meta{
		Title:        siteName,
		SiteName:     siteName,
		Description:  defaultDescription,
		Canonical:    canonical,
		OpenGraphURL: openGraphURL,
		Image:        absoluteURL(frontendOrigin, defaultImagePath),
		Robots:       "index, follow",
		Type:         "website",
		RedirectURL:  canonical,
	}

	if matched, matches, ok := matchPathMeta(frontendPath); ok {
		if matched.SiteName != "" {
			meta.SiteName = matched.SiteName
		}
		meta.Title = fullTitleForSite(matched.Title, meta.SiteName)
		meta.Description = matched.Description
		if matched.Image != "" {
			meta.Image = absoluteURL(frontendOrigin, matched.Image)
		}
		if matched.Apply != nil {
			matched.Apply(&meta, matches)
		}
	}

	return meta
}

func applyLegacyNekomaidMeta(meta *modelSNS.Meta, matches []string) {
	site := matches[1]
	segments := []string{"", "nekomaid", site}
	if len(matches) > 2 && matches[2] != "" {
		segments = append(segments, matches[2])
	}
	if len(matches) > 3 && matches[3] != "" {
		segments = append(segments, matches[3])
	}

	targetPath := strings.Join(segments, "/")
	frontendOrigin := frontendOrigin()
	meta.Canonical = absoluteURL(frontendOrigin, targetPath)
	meta.OpenGraphURL = absoluteURL(frontendOrigin, "/sns"+targetPath)
	meta.RedirectURL = meta.Canonical

	if len(matches) > 3 && matches[2] != "" && matches[3] != "" {
		applyNekomaidArtworkMeta(meta, site, matches[2], matches[3])
	}
}

func applyNekomaidArtworkMetaFromMatches(meta *modelSNS.Meta, matches []string) {
	applyNekomaidArtworkMeta(meta, matches[1], matches[2], matches[3])
}

func applyNekomaidArtworkMeta(meta *modelSNS.Meta, site string, authorID string, artworkID string) {
	artwork, authorName, ok := fetchNekomaidArtworkMeta(site, authorID, artworkID)
	if !ok {
		return
	}

	title := strings.TrimSpace(artwork.Title)
	if title == "" {
		title = artworkID
	}
	meta.Title = fullTitleForSite(title, meta.SiteName)

	parts := []string{fmt.Sprintf("「%s」", title)}
	if authorName != "" {
		parts = append(parts, "作者："+authorName)
	}
	if siteLabel := nekomaidSiteLabel(site); siteLabel != "" {
		parts = append(parts, "來源："+siteLabel)
	}
	if len(artwork.Tags) > 0 {
		parts = append(parts, "標籤："+strings.Join(limitStrings(artwork.Tags, 8), "、"))
	}
	if len(artwork.Photos) > 1 {
		parts = append(parts, fmt.Sprintf("共 %d 張圖片", len(artwork.Photos)))
	}
	meta.Description = strings.Join(parts, "，") + "。"

	if image := nekomaidArtworkImage(artwork); image != "" && !nekomaidArtworkIsR18(artwork) {
		meta.Image = image
	}
}

func fetchNekomaidArtworkMetaFromAPI(site string, authorID string, artworkID string) (nekomaidArtworkMeta, string, bool) {
	cacheKey := fmt.Sprintf("sns:nekomaid:artwork:%s:%s:%s", site, authorID, artworkID)
	if r := client.GetRedis(enum.RedisDefault); r != nil {
		if raw, err := r.Get(cacheKey).Result(); err == nil && raw != "" {
			var cached nekomaidArtworkAPIResponse
			if err := json.Unmarshal([]byte(raw), &cached); err == nil {
				artwork, ok := nekomaidResponseArtwork(cached)
				if ok {
					return artwork, nekomaidAuthorName(cached), true
				}
			}
		}
	}

	apiURL := fmt.Sprintf("%s/%s/%s/%s", nekomaidAPIBase, url.PathEscape(site), url.PathEscape(authorID), url.PathEscape(artworkID))
	httpClient := http.Client{Timeout: 5 * time.Second}
	resp, err := httpClient.Get(apiURL)
	if err != nil {
		return nekomaidArtworkMeta{}, "", false
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nekomaidArtworkMeta{}, "", false
	}

	var data nekomaidArtworkAPIResponse
	if err := json.NewDecoder(resp.Body).Decode(&data); err != nil {
		return nekomaidArtworkMeta{}, "", false
	}
	artwork, ok := nekomaidResponseArtwork(data)
	if !ok {
		return nekomaidArtworkMeta{}, "", false
	}

	if r := client.GetRedis(enum.RedisDefault); r != nil {
		if raw, err := json.Marshal(data); err == nil {
			_ = r.Set(cacheKey, string(raw), 24*time.Hour).Err()
		}
	}

	return artwork, nekomaidAuthorName(data), true
}

func nekomaidResponseArtwork(data nekomaidArtworkAPIResponse) (nekomaidArtworkMeta, bool) {
	candidates := []nekomaidArtworkMeta{data.Artwork, data.Item, data.Illust}
	if len(data.Recommendations) > 0 {
		candidates = append(candidates, data.Recommendations...)
	}

	for _, artwork := range candidates {
		if strings.TrimSpace(artwork.Title) != "" || strings.TrimSpace(artwork.ArtworkID) != "" {
			return artwork, true
		}
	}
	return nekomaidArtworkMeta{}, false
}

func nekomaidAuthorName(data nekomaidArtworkAPIResponse) string {
	if name := strings.TrimSpace(data.Author.Nickname); name != "" {
		return name
	}
	return strings.TrimSpace(data.Author.Author)
}

func nekomaidArtworkImage(artwork nekomaidArtworkMeta) string {
	if strings.TrimSpace(artwork.Thumb) != "" {
		return artwork.Thumb
	}
	if len(artwork.Photos) > 0 {
		return strings.TrimSpace(artwork.Photos[0].URL)
	}
	return ""
}

func nekomaidArtworkIsR18(artwork nekomaidArtworkMeta) bool {
	if artwork.R18 {
		return true
	}
	switch value := artwork.IsR18.(type) {
	case bool:
		return value
	case float64:
		return value > 0
	case string:
		return value == "1" || strings.EqualFold(value, "true")
	default:
		return false
	}
}

func nekomaidSiteLabel(site string) string {
	switch site {
	case "pixiv":
		return "Pixiv"
	case "nico":
		return "Niconico 靜畫"
	case "tinami":
		return "TINAMI"
	default:
		return site
	}
}

func limitStrings(values []string, limit int) []string {
	if len(values) <= limit {
		return values
	}
	return values[:limit]
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
	return fullTitleForSite(page, siteName)
}

func fullTitleForSite(page string, currentSiteName string) string {
	page = strings.TrimSpace(page)
	if currentSiteName == "" {
		currentSiteName = siteName
	}
	if page == "" || page == currentSiteName {
		return currentSiteName
	}
	return page + " | " + currentSiteName
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
	if parsed, err := url.Parse(targetPath); err == nil && parsed.IsAbs() {
		return parsed.String()
	}

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

func stripTrackingQuery(query string) string {
	query = strings.TrimPrefix(strings.TrimSpace(query), "?")
	if query == "" {
		return ""
	}

	values, err := url.ParseQuery(query)
	if err != nil {
		return query
	}

	for key := range values {
		normalizedKey := strings.ToLower(key)
		if isTrackingQueryKey(normalizedKey) {
			delete(values, key)
		}
	}

	return values.Encode()
}

func isTrackingQueryKey(key string) bool {
	if strings.HasPrefix(key, "utm_") {
		return true
	}

	switch key {
	case "fbclid",
		"fbc_id",
		"fb_action_ids",
		"fb_action_types",
		"fb_source",
		"igshid",
		"twclid",
		"li_fat_id",
		"trk",
		"trkemail",
		"lipi",
		"ttclid",
		"gclid",
		"dclid",
		"gbraid",
		"wbraid",
		"msclkid",
		"yclid",
		"mc_cid",
		"mc_eid",
		"vero_id",
		"_hsenc",
		"_hsmi",
		"mkt_tok",
		"scid",
		"si",
		"spm",
		"ref_src",
		"ref_url",
		"share_id",
		"sharecid",
		"feature",
		"app",
		"entry_point",
		"source",
		"campaign_id",
		"ad_id",
		"adgroup_id",
		"creative_id",
		"gad_source":
		return true
	default:
		return false
	}
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
  <meta property="og:site_name" content="{{ .SiteName }}">
  <meta property="og:locale" content="zh_TW">
  <meta property="og:title" content="{{ .Title }}">
  <meta property="og:description" content="{{ .Description }}">
  <meta property="og:url" content="{{ .OpenGraphURL }}">
  <meta property="og:image" content="{{ .Image }}">
  <meta property="og:image:alt" content="{{ .SiteName }}">
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
    "isPartOf":{"@type":"WebSite","name":{{ .SiteName | printf "%q" }},"url":"` + defaultFrontendURL + `"}
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
