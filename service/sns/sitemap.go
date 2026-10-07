package sns

import (
	"encoding/xml"
	"net/url"
	"strings"
	"time"

	"faryne.dev/model/enum"
	"faryne.dev/service/client"
	"faryne.dev/service/log"
	"faryne.dev/service/storyteller"

	"go.uber.org/zap"
)

// SteamLoom 的 robots.txt／sitemap.xml：steamloom.works 跟主站共用同一份前端 build，
// public/ 底下那份是 faryne.dev 的，所以由 nginx 把這兩個路徑轉來後端動態產生。

const (
	// sitemapMaxURLs 是單一 sitemap 檔的規格上限；目前規模用不到 sitemap index，超過就截斷並記 log
	sitemapMaxURLs  = 50000
	sitemapCacheKey = "sns:steamloom:sitemap:v1"
	sitemapCacheTTL = time.Hour
)

// SteamLoomRobotsTxt 私人頁（工作台、授權、分享連結、站內搜尋結果）不給爬
func SteamLoomRobotsTxt() string {
	return strings.Join([]string{
		"User-agent: *",
		"Allow: /",
		"Disallow: /my/",
		"Disallow: /oauth/",
		"Disallow: /mcp",
		"Disallow: /work/share/",
		"Disallow: /search",
		"",
		"Sitemap: " + steamloomOrigin + "/sitemap.xml",
		"",
	}, "\n")
}

type sitemapURL struct {
	Loc     string `xml:"loc"`
	LastMod string `xml:"lastmod,omitempty"`
}

type sitemapURLSet struct {
	XMLName xml.Name     `xml:"urlset"`
	XMLNS   string       `xml:"xmlns,attr"`
	URLs    []sitemapURL `xml:"url"`
}

var fetchSitemapData = func() (*storyteller.SitemapData, error) {
	return storyteller.NewService().Sitemap(sitemapMaxURLs)
}

// SteamLoomSitemapXML 首頁、公開作品首頁、已發佈的故事、已公開且不是劇透的設定、有公開作品的作者頁
func SteamLoomSitemapXML() (string, error) {
	r := client.GetRedis(enum.RedisDefault)
	if r != nil {
		if cached, err := r.Get(sitemapCacheKey).Result(); err == nil && cached != "" {
			return cached, nil
		}
	}
	data, err := fetchSitemapData()
	if err != nil {
		return "", err
	}
	body, err := buildSteamLoomSitemap(data)
	if err != nil {
		return "", err
	}
	if r != nil {
		_ = r.Set(sitemapCacheKey, body, sitemapCacheTTL).Err()
	}
	return body, nil
}

func buildSteamLoomSitemap(data *storyteller.SitemapData) (string, error) {
	urls := []sitemapURL{{Loc: steamloomOrigin + "/"}}
	add := func(path string, updatedAt time.Time) {
		entry := sitemapURL{Loc: steamloomOrigin + path}
		if !updatedAt.IsZero() {
			entry.LastMod = updatedAt.UTC().Format("2006-01-02")
		}
		urls = append(urls, entry)
	}
	// 作品路徑跟前端 storytellerReaderPath 一致：work/{public_id}-{slug}
	workPath := func(publicID, slug string) string { return "/work/" + url.PathEscape(publicID+"-"+slug) }
	for _, project := range data.Projects {
		add(workPath(project.PublicID, project.Slug), project.UpdatedAt)
	}
	for _, story := range data.Stories {
		add(workPath(story.ProjectPublicID, story.ProjectSlug)+"/story/"+url.PathEscape(story.ItemPublicID), story.UpdatedAt)
	}
	for _, lore := range data.Lores {
		add(workPath(lore.ProjectPublicID, lore.ProjectSlug)+"/lore/"+url.PathEscape(lore.ItemPublicID), lore.UpdatedAt)
	}
	for _, penName := range data.PenNames {
		add("/user/"+url.PathEscape(penName), time.Time{})
	}
	if len(urls) > sitemapMaxURLs {
		log.Logger().Warn("SteamLoom sitemap truncated", zap.Int("total", len(urls)), zap.Int("limit", sitemapMaxURLs))
		urls = urls[:sitemapMaxURLs]
	}
	out, err := xml.MarshalIndent(sitemapURLSet{XMLNS: "http://www.sitemaps.org/schemas/sitemap/0.9", URLs: urls}, "", "  ")
	if err != nil {
		return "", err
	}
	return xml.Header + string(out) + "\n", nil
}
