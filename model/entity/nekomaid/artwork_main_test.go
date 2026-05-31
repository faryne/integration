package nekomaid

import (
	"sync"
	"testing"

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
