package nekomaid

import (
	"strings"
	"sync"
	"testing"
	"unicode/utf8"

	"faryne.dev/model/enum"
	"gorm.io/gorm/schema"
)

func TestArtworkMainSchemaParsesFullContentAsJSON(t *testing.T) {
	if _, err := schema.Parse(&ArtworkMain{}, &sync.Map{}, schema.NamingStrategy{}); err != nil {
		t.Fatalf("parse ArtworkMain schema: %v", err)
	}
}

func TestArtworkMainFullContentValueScanRoundTrip(t *testing.T) {
	content := ArtworkMainFullContent{
		From:      enum.NekomaidSitePixiv,
		AuthorId:  "author-1",
		ArtworkId: "artwork-1",
		Title:     "title",
		Photos: []ArtworkPhoto{
			{
				Width:    800,
				Height:   600,
				Filename: "artwork-1_abcde.jpg",
				Url:      "https://example.com/artwork-1_abcde.jpg",
			},
		},
		Tags:  []string{"tag-a", "tag-b"},
		Thumb: "https://example.com/thumb.jpg",
	}

	value, err := content.Value()
	if err != nil {
		t.Fatalf("marshal full content: %v", err)
	}

	var scanned ArtworkMainFullContent
	if err := scanned.Scan(value); err != nil {
		t.Fatalf("scan full content: %v", err)
	}

	if scanned.From != content.From || scanned.AuthorId != content.AuthorId || scanned.ArtworkId != content.ArtworkId {
		t.Fatalf("scanned identity mismatch: got %+v want %+v", scanned, content)
	}
	if len(scanned.Photos) != 1 || scanned.Photos[0].Filename != content.Photos[0].Filename {
		t.Fatalf("scanned photos mismatch: got %+v want %+v", scanned.Photos, content.Photos)
	}
	if len(scanned.Tags) != 2 || scanned.Tags[0] != "tag-a" || scanned.Tags[1] != "tag-b" {
		t.Fatalf("scanned tags mismatch: got %+v want %+v", scanned.Tags, content.Tags)
	}
}

func TestArtworkMainFullContentValueEscapesNonASCII(t *testing.T) {
	content := ArtworkMainFullContent{
		From:        enum.NekomaidSitePixiv,
		AuthorId:    "82517969",
		ArtworkId:   "145304494",
		Title:       "エイメス rover",
		Author:      "smodo",
		Tags:        []string{"명조", "鳴潮", "鸣潮", "女孩子", "emoji 😀"},
		Description: "説明",
	}

	value, err := content.Value()
	if err != nil {
		t.Fatalf("marshal full content: %v", err)
	}

	raw, ok := value.(string)
	if !ok {
		t.Fatalf("value type = %T, want string", value)
	}
	if !utf8.ValidString(raw) {
		t.Fatalf("escaped JSON is not valid UTF-8: %q", raw)
	}
	for _, r := range raw {
		if r >= utf8.RuneSelf {
			t.Fatalf("escaped JSON contains non-ASCII rune %q in %q", r, raw)
		}
	}
	for _, text := range []string{"エイメス", "명조", "鳴潮", "女孩子", "😀"} {
		if strings.Contains(raw, text) {
			t.Fatalf("escaped JSON still contains raw non-ASCII text %q: %q", text, raw)
		}
	}
	for _, escaped := range []string{`\u30a8`, `\uba85`, `\u9cf4`, `\u5973`, `\ud83d\ude00`} {
		if !strings.Contains(raw, escaped) {
			t.Fatalf("escaped JSON missing %s: %q", escaped, raw)
		}
	}

	var scanned ArtworkMainFullContent
	if err := scanned.Scan(raw); err != nil {
		t.Fatalf("scan escaped full content: %v", err)
	}
	if scanned.Title != content.Title || scanned.Description != content.Description {
		t.Fatalf("scanned content mismatch: got %+v want %+v", scanned, content)
	}
	if len(scanned.Tags) != len(content.Tags) || scanned.Tags[0] != content.Tags[0] || scanned.Tags[4] != content.Tags[4] {
		t.Fatalf("scanned tags mismatch: got %+v want %+v", scanned.Tags, content.Tags)
	}
}
