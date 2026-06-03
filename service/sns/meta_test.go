package sns

import (
	"strings"
	"testing"

	modelSNS "faryne.dev/model/entity/sns"
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
