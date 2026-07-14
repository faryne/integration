package sns

import (
	"strings"
	"testing"

	modelSNS "faryne.dev/model/entity/sns"
	"faryne.dev/service/nccc"
)

func TestBuildMetaStaticRoute(t *testing.T) {
	meta := BuildMeta(modelSNS.RenderRequest{Path: "data/rates", Query: "base=TWD"})

	if !strings.Contains(meta.Title, "匯率") {
		t.Fatalf("expected rates title, got %q", meta.Title)
	}
	if meta.Canonical != "https://beta.faryne.dev/data/rates?base=TWD" {
		t.Fatalf("unexpected canonical: %s", meta.Canonical)
	}
	if meta.OpenGraphURL != "https://beta.faryne.dev/sns/data/rates?base=TWD" {
		t.Fatalf("unexpected og:url: %s", meta.OpenGraphURL)
	}
	if meta.RedirectURL != meta.Canonical {
		t.Fatalf("redirect URL should match canonical")
	}
}

func TestBuildMetaStripsTrackingQuery(t *testing.T) {
	meta := BuildMeta(modelSNS.RenderRequest{
		Path:  "data/etf/twse/0050",
		Query: "category=BOND&strategy=high-win-rate&fbclid=abc&utm_source=facebook&fbc_id=def&twclid=x&li_fat_id=y&ttclid=z&msclkid=m",
	})

	expectedCanonical := "https://beta.faryne.dev/data/etf/twse/0050?category=BOND&strategy=high-win-rate"
	expectedOpenGraphURL := "https://beta.faryne.dev/sns/data/etf/twse/0050?category=BOND&strategy=high-win-rate"

	if meta.Canonical != expectedCanonical {
		t.Fatalf("unexpected canonical: %s", meta.Canonical)
	}
	if meta.OpenGraphURL != expectedOpenGraphURL {
		t.Fatalf("unexpected og:url: %s", meta.OpenGraphURL)
	}
	if meta.RedirectURL != expectedCanonical {
		t.Fatalf("unexpected redirect URL: %s", meta.RedirectURL)
	}
}

func TestStripTrackingQueryKeepsUnknownBusinessParams(t *testing.T) {
	cleanQuery := stripTrackingQuery("ref=business&source=facebook&share_id=abc&code=0050")

	if cleanQuery != "code=0050&ref=business" {
		t.Fatalf("unexpected clean query: %s", cleanQuery)
	}
}

func TestBuildMetaRouteCanOverrideImage(t *testing.T) {
	originalCollection := pathCollection
	pathCollection = []pathMeta{
		{Path: "/custom-image", Title: "Custom Image", Description: "Custom image route.", Image: "/custom-og.jpg"},
	}
	defer func() {
		pathCollection = originalCollection
	}()

	meta := BuildMeta(modelSNS.RenderRequest{Path: "custom-image"})

	if meta.Image != "https://beta.faryne.dev/custom-og.jpg" {
		t.Fatalf("unexpected image: %s", meta.Image)
	}
}

func TestAbsoluteURLKeepsAbsoluteImageURL(t *testing.T) {
	got := absoluteURL("https://beta.faryne.dev", "https://cdn.example.com/og.jpg")

	if got != "https://cdn.example.com/og.jpg" {
		t.Fatalf("unexpected absolute URL: %s", got)
	}
}

func TestBuildMetaRejectsAbsolutePath(t *testing.T) {
	meta := BuildMeta(modelSNS.RenderRequest{Path: "https://evil.example/path"})

	if meta.Canonical != "https://beta.faryne.dev/" {
		t.Fatalf("unexpected canonical: %s", meta.Canonical)
	}
}

func TestBuildMetaDynamicETFRoute(t *testing.T) {
	meta := BuildMeta(modelSNS.RenderRequest{Path: "data/etf/twse/0050"})

	if !strings.Contains(meta.Title, "0050") {
		t.Fatalf("expected ETF code in title, got %q", meta.Title)
	}
	if !strings.Contains(meta.Description, "0050") {
		t.Fatalf("expected ETF code in description, got %q", meta.Description)
	}
}

func TestBuildMetaNCCCRoute(t *testing.T) {
	meta := BuildMeta(modelSNS.RenderRequest{Path: "data/nccc"})
	origin := frontendOrigin()

	if !strings.Contains(meta.Title, "NCCC 信用卡消費資料") {
		t.Fatalf("expected NCCC title, got %q", meta.Title)
	}
	if meta.Canonical != origin+"/data/nccc" {
		t.Fatalf("unexpected canonical: %s", meta.Canonical)
	}
	if meta.OpenGraphURL != origin+"/sns/data/nccc" {
		t.Fatalf("unexpected og:url: %s", meta.OpenGraphURL)
	}
}

func TestBuildMetaDynamicNCCCRoute(t *testing.T) {
	indexes := nccc.ListIndexes()
	if len(indexes) == 0 {
		t.Fatal("expected fallback NCCC indexes")
	}

	meta := BuildMeta(modelSNS.RenderRequest{
		Path:  "data/nccc/" + indexes[0].Token,
		Query: "yearMonths=113%E5%B9%B401%E6%9C%88&f=abc&fbclid=tracking",
	})

	if !strings.Contains(meta.Title, indexes[0].Text) {
		t.Fatalf("expected NCCC index text in title, got %q", meta.Title)
	}
	if !strings.Contains(meta.Description, indexes[0].Text) {
		t.Fatalf("expected NCCC index text in description, got %q", meta.Description)
	}
	origin := frontendOrigin()
	expectedCanonical := origin + "/data/nccc/" + indexes[0].Token + "?f=abc&yearMonths=113%E5%B9%B401%E6%9C%88"
	expectedOpenGraphURL := origin + "/sns/data/nccc/" + indexes[0].Token + "?f=abc&yearMonths=113%E5%B9%B401%E6%9C%88"
	if meta.Canonical != expectedCanonical {
		t.Fatalf("unexpected canonical: %s", meta.Canonical)
	}
	if meta.OpenGraphURL != expectedOpenGraphURL {
		t.Fatalf("unexpected og:url: %s", meta.OpenGraphURL)
	}
}

func TestBuildMetaStorytellerPublicProjectRoute(t *testing.T) {
	originalFetch := fetchStorytellerPublicProjectMeta
	fetchStorytellerPublicProjectMeta = func(projectPath string) (storytellerProjectMeta, bool) {
		if projectPath != "abc123-my-story" {
			t.Fatalf("unexpected project path: %s", projectPath)
		}
		return storytellerProjectMeta{
			Title:       "河燈之城",
			Description: "一段關於河港、燈影與記憶的故事。",
		}, true
	}
	defer func() {
		fetchStorytellerPublicProjectMeta = originalFetch
	}()

	meta := BuildMeta(modelSNS.RenderRequest{Path: "storyteller/story/abc123-my-story/chapter-1"})

	if meta.Title != "河燈之城 | ha2.tw / faryne.dev" {
		t.Fatalf("unexpected title: %s", meta.Title)
	}
	if meta.Description != "一段關於河港、燈影與記憶的故事。" {
		t.Fatalf("unexpected description: %s", meta.Description)
	}
	if meta.Type != "article" {
		t.Fatalf("unexpected type: %s", meta.Type)
	}
	if meta.Robots != "index, follow" {
		t.Fatalf("unexpected robots: %s", meta.Robots)
	}
}

func TestBuildMetaStorytellerSharedProjectRoute(t *testing.T) {
	originalFetch := fetchStorytellerSharedProjectMeta
	fetchStorytellerSharedProjectMeta = func(shareToken string) (storytellerProjectMeta, bool) {
		if shareToken != "share-token" {
			t.Fatalf("unexpected share token: %s", shareToken)
		}
		return storytellerProjectMeta{
			Title:       "親友限定故事",
			Description: "只分享給親友看的故事摘要。",
		}, true
	}
	defer func() {
		fetchStorytellerSharedProjectMeta = originalFetch
	}()

	meta := BuildMeta(modelSNS.RenderRequest{Path: "storyteller/story/share/share-token/chapter-1"})

	if meta.Title != "親友限定故事 | ha2.tw / faryne.dev" {
		t.Fatalf("unexpected title: %s", meta.Title)
	}
	if meta.Description != "只分享給親友看的故事摘要。" {
		t.Fatalf("unexpected description: %s", meta.Description)
	}
	if meta.Type != "article" {
		t.Fatalf("unexpected type: %s", meta.Type)
	}
	if meta.Robots != "noindex, nofollow" {
		t.Fatalf("unexpected robots: %s", meta.Robots)
	}
}

func TestBuildMetaSteamLoomPublicStoryRouteIsSelfCanonical(t *testing.T) {
	originalFetch := fetchStorytellerPublicProjectMeta
	fetchStorytellerPublicProjectMeta = func(projectPath string) (storytellerProjectMeta, bool) {
		if projectPath != "abc123-my-story" {
			t.Fatalf("unexpected project path: %s", projectPath)
		}
		return storytellerProjectMeta{
			Title:       "河燈之城",
			Description: "一段關於河港、燈影與記憶的故事。",
		}, true
	}
	defer func() {
		fetchStorytellerPublicProjectMeta = originalFetch
	}()

	meta := BuildMeta(modelSNS.RenderRequest{
		Path: "storyteller/story/abc123-my-story/chapter-1",
		Host: "steamloom.works",
	})

	if meta.Title != "河燈之城 | SteamLoom" {
		t.Fatalf("unexpected title: %s", meta.Title)
	}
	if meta.Canonical != "https://steamloom.works/story/abc123-my-story/chapter-1" {
		t.Fatalf("unexpected canonical: %s", meta.Canonical)
	}
	if meta.OpenGraphURL != "https://steamloom.works/sns/story/abc123-my-story/chapter-1" {
		t.Fatalf("unexpected og:url: %s", meta.OpenGraphURL)
	}
	if meta.Robots != "index, follow" {
		t.Fatalf("unexpected robots: %s", meta.Robots)
	}
}

func TestBuildMetaSteamLoomSharedStoryRouteIsSelfCanonical(t *testing.T) {
	originalFetch := fetchStorytellerSharedProjectMeta
	fetchStorytellerSharedProjectMeta = func(shareToken string) (storytellerProjectMeta, bool) {
		if shareToken != "share-token" {
			t.Fatalf("unexpected share token: %s", shareToken)
		}
		return storytellerProjectMeta{
			Title:       "親友限定故事",
			Description: "只分享給親友看的故事摘要。",
		}, true
	}
	defer func() {
		fetchStorytellerSharedProjectMeta = originalFetch
	}()

	meta := BuildMeta(modelSNS.RenderRequest{
		Path: "storyteller/story/share/share-token/chapter-1",
		Host: "www.steamloom.works",
	})

	if meta.Title != "親友限定故事 | SteamLoom" {
		t.Fatalf("unexpected title: %s", meta.Title)
	}
	if meta.Canonical != "https://steamloom.works/story/share/share-token/chapter-1" {
		t.Fatalf("unexpected canonical: %s", meta.Canonical)
	}
	if meta.Robots != "noindex, nofollow" {
		t.Fatalf("unexpected robots: %s", meta.Robots)
	}
}

func TestBuildMetaSteamLoomHomeFallsBackToBrandDefaults(t *testing.T) {
	meta := BuildMeta(modelSNS.RenderRequest{Path: "storyteller", Host: "steamloom.works"})

	if meta.SiteName != "SteamLoom" {
		t.Fatalf("unexpected site name: %s", meta.SiteName)
	}
	if meta.Canonical != "https://steamloom.works/" {
		t.Fatalf("unexpected canonical: %s", meta.Canonical)
	}
}

func TestBuildMetaNekomaidRouteUsesProjectSiteName(t *testing.T) {
	meta := BuildMeta(modelSNS.RenderRequest{Path: "nekomaid"})

	if meta.Title != "難以名狀的抓圖器" {
		t.Fatalf("unexpected title: %s", meta.Title)
	}
	if meta.SiteName != "難以名狀的抓圖器" {
		t.Fatalf("unexpected site name: %s", meta.SiteName)
	}
	if !strings.Contains(meta.Description, "Pixiv") {
		t.Fatalf("expected nekomaid description, got %q", meta.Description)
	}
}

func TestBuildMetaNekomaidPrefixRoute(t *testing.T) {
	meta := BuildMeta(modelSNS.RenderRequest{Path: "nekomaid/pixiv/123/456"})

	if meta.Title != "難以名狀的抓圖器" {
		t.Fatalf("unexpected title: %s", meta.Title)
	}
	if meta.Canonical != "https://beta.faryne.dev/nekomaid/pixiv/123/456" {
		t.Fatalf("unexpected canonical: %s", meta.Canonical)
	}
	if meta.OpenGraphURL != "https://beta.faryne.dev/sns/nekomaid/pixiv/123/456" {
		t.Fatalf("unexpected og:url: %s", meta.OpenGraphURL)
	}
}

func TestBuildMetaLegacyNekomaidSiteRoute(t *testing.T) {
	meta := BuildMeta(modelSNS.RenderRequest{Path: "pixiv"})

	if meta.Title != "難以名狀的抓圖器" {
		t.Fatalf("unexpected title: %s", meta.Title)
	}
	if meta.Canonical != "https://beta.faryne.dev/nekomaid/pixiv" {
		t.Fatalf("unexpected canonical: %s", meta.Canonical)
	}
	if meta.RedirectURL != meta.Canonical {
		t.Fatalf("unexpected redirect URL: %s", meta.RedirectURL)
	}
	if meta.OpenGraphURL != "https://beta.faryne.dev/sns/nekomaid/pixiv" {
		t.Fatalf("unexpected og:url: %s", meta.OpenGraphURL)
	}
}

func TestBuildMetaLegacyNekomaidAuthorRoute(t *testing.T) {
	meta := BuildMeta(modelSNS.RenderRequest{Path: "pixiv/123"})

	if meta.Canonical != "https://beta.faryne.dev/nekomaid/pixiv/123" {
		t.Fatalf("unexpected canonical: %s", meta.Canonical)
	}
}

func TestBuildMetaLegacyNekomaidArtworkRoute(t *testing.T) {
	meta := BuildMeta(modelSNS.RenderRequest{Path: "pixiv/123/456"})

	if meta.Canonical != "https://beta.faryne.dev/nekomaid/pixiv/123/456" {
		t.Fatalf("unexpected canonical: %s", meta.Canonical)
	}
	if meta.OpenGraphURL != "https://beta.faryne.dev/sns/nekomaid/pixiv/123/456" {
		t.Fatalf("unexpected og:url: %s", meta.OpenGraphURL)
	}
}

func TestBuildMetaNekomaidArtworkRouteUsesFetchedContent(t *testing.T) {
	originalFetch := fetchNekomaidArtworkMeta
	fetchNekomaidArtworkMeta = func(site string, authorID string, artworkID string) (nekomaidArtworkMeta, string, bool) {
		if site != "pixiv" || authorID != "123" || artworkID != "456" {
			t.Fatalf("unexpected fetch args: %s %s %s", site, authorID, artworkID)
		}
		return nekomaidArtworkMeta{
			Title: "測試作品",
			Tags:  []string{"tag1", "tag2"},
			Thumb: "https://cdn.example.com/thumb.jpg",
			Photos: []struct {
				URL string `json:"url"`
			}{
				{URL: "https://cdn.example.com/1.jpg"},
				{URL: "https://cdn.example.com/2.jpg"},
			},
		}, "測試作者", true
	}
	defer func() {
		fetchNekomaidArtworkMeta = originalFetch
	}()

	meta := BuildMeta(modelSNS.RenderRequest{Path: "nekomaid/pixiv/123/456"})

	if meta.Title != "測試作品 | 難以名狀的抓圖器" {
		t.Fatalf("unexpected title: %s", meta.Title)
	}
	if !strings.Contains(meta.Description, "測試作者") || !strings.Contains(meta.Description, "共 2 張圖片") {
		t.Fatalf("unexpected description: %s", meta.Description)
	}
	if meta.Image != "https://cdn.example.com/thumb.jpg" {
		t.Fatalf("unexpected image: %s", meta.Image)
	}
}

func TestBuildMetaLegacyNekomaidArtworkRouteUsesFetchedContent(t *testing.T) {
	originalFetch := fetchNekomaidArtworkMeta
	fetchNekomaidArtworkMeta = func(site string, authorID string, artworkID string) (nekomaidArtworkMeta, string, bool) {
		return nekomaidArtworkMeta{Title: "Legacy Title"}, "", true
	}
	defer func() {
		fetchNekomaidArtworkMeta = originalFetch
	}()

	meta := BuildMeta(modelSNS.RenderRequest{Path: "pixiv/123/456"})

	if meta.Title != "Legacy Title | 難以名狀的抓圖器" {
		t.Fatalf("unexpected title: %s", meta.Title)
	}
	if meta.Canonical != "https://beta.faryne.dev/nekomaid/pixiv/123/456" {
		t.Fatalf("unexpected canonical: %s", meta.Canonical)
	}
}

func TestBuildMetaNekomaidR18ArtworkKeepsDefaultImage(t *testing.T) {
	originalFetch := fetchNekomaidArtworkMeta
	fetchNekomaidArtworkMeta = func(site string, authorID string, artworkID string) (nekomaidArtworkMeta, string, bool) {
		return nekomaidArtworkMeta{
			Title: "R18作品",
			Thumb: "https://cdn.example.com/r18.jpg",
			R18:   true,
		}, "", true
	}
	defer func() {
		fetchNekomaidArtworkMeta = originalFetch
	}()

	meta := BuildMeta(modelSNS.RenderRequest{Path: "nekomaid/pixiv/123/456"})

	if meta.Image != "https://beta.faryne.dev/faryne-icon-1024.jpg" {
		t.Fatalf("unexpected image for r18 artwork: %s", meta.Image)
	}
}

func TestRenderHTMLNekomaidSiteName(t *testing.T) {
	html, err := RenderHTML(modelSNS.RenderRequest{Path: "nekomaid"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(html, `og:site_name" content="難以名狀的抓圖器"`) {
		t.Fatalf("html should include nekomaid site name: %s", html)
	}
}

func TestRenderHTMLEscapesContent(t *testing.T) {
	html, err := RenderHTML(modelSNS.RenderRequest{Path: "data/tw-stats/<script>"})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(html, "<script>alert") {
		t.Fatalf("html should escape path-derived content")
	}
	if !strings.Contains(html, "og:title") {
		t.Fatalf("html should include social meta tags")
	}
}

func TestRenderHTMLRedirectScriptUsesAbsoluteURL(t *testing.T) {
	html, err := RenderHTML(modelSNS.RenderRequest{Path: "data/etf/twse/00961"})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(html, `location.replace("https://beta.faryne.dev/data/etf/twse/00961")`) {
		t.Fatalf("redirect script should use the canonical URL as a JS string, got: %s", html)
	}
	if strings.Contains(html, "%22https://") || strings.Contains(html, "&#34;https://") {
		t.Fatalf("redirect script must not encode quotes into the URL")
	}
}
