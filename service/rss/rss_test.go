package rss

import (
	"strings"
	"testing"
	"time"
)

func TestRender(t *testing.T) {
	out, err := Render(Channel{Title: "t&t", Link: "https://x/?a=1&b=2", Items: []Item{{
		Title: "i", GUID: GUID{IsPermaLink: true, Value: "https://x/1"}, Description: Description{Value: "<p>x</p>"},
		Enclosure: ImageEnclosure("https://x/a.WEBP"),
	}}})
	if err != nil {
		t.Fatal(err)
	}
	// 特殊字元要跳脫、description 用 CDATA、沒有 language／pubDate 時不輸出
	for _, want := range []string{`<rss version="2.0">`, "t&amp;t", "a=1&amp;b=2", "<![CDATA[<p>x</p>]]>", `type="image/webp"`} {
		if !strings.Contains(out, want) {
			t.Fatalf("missing %q in\n%s", want, out)
		}
	}
	if strings.Contains(out, "<language>") || strings.Contains(out, "<pubDate>") {
		t.Fatal(out)
	}
}

func TestPubDateAndEnclosure(t *testing.T) {
	if PubDate(time.Time{}) != "" || ImageEnclosure("") != nil {
		t.Fatal("零值要回空")
	}
	if got := PubDate(time.Date(2026, 11, 19, 0, 0, 0, 0, time.FixedZone("JST", 9*3600))); got != "Thu, 19 Nov 2026 00:00:00 +0900" {
		t.Fatal(got)
	}
}
