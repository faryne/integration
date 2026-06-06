package nekomaid

import (
	"testing"
	"time"

	"faryne.dev/model/entity/nekomaid"
	"faryne.dev/model/enum"
)

func TestBuildArtworkIndexDocument(t *testing.T) {
	createdAt := time.Unix(1780000000, 0)
	artwork := &nekomaid.ArtworkMain{
		Site:       enum.NekomaidSitePixiv,
		AuthorId:   "123",
		ArtworkId:  "456",
		IsR18:      true,
		IsAnimated: true,
		CreatedOn:  createdAt,
		FullContent: nekomaid.ArtworkMainFullContent{
			From:       enum.NekomaidSitePixiv,
			AuthorId:   "123",
			ArtworkId:  "456",
			Title:      "title",
			Tags:       []string{"tag-a", "tag-b"},
			Thumb:      "https://example.com/thumb.png",
			IsAnimated: 1,
			Photos: []nekomaid.ArtworkPhoto{
				{Width: 400, Height: 200, Url: "https://example.com/1.webm"},
			},
		},
	}

	doc := buildArtworkIndexDocument(artwork)
	if doc.ArtworkId != "456" || doc.AuthorId != "123" || doc.From != enum.NekomaidSitePixiv {
		t.Fatalf("unexpected identity fields: %+v", doc)
	}
	if !doc.R18 || doc.Gif != 1 || doc.Type != "ugoira" {
		t.Fatalf("unexpected flags/type: r18=%v gif=%d type=%s", doc.R18, doc.Gif, doc.Type)
	}
	if doc.PublishedDt != createdAt.Unix() {
		t.Fatalf("published_dt = %d, want %d", doc.PublishedDt, createdAt.Unix())
	}
	if doc.PhotosCnt != 1 || len(doc.Photos) != 1 {
		t.Fatalf("photos count mismatch: %+v", doc.Photos)
	}
	if doc.Photos[0].Ratio != 2 {
		t.Fatalf("photo ratio = %f, want 2", doc.Photos[0].Ratio)
	}
	if len(doc.TagCompletion) != 2 || doc.TagCompletion[0].Input != "tag-a" {
		t.Fatalf("tag completion mismatch: %+v", doc.TagCompletion)
	}
}

func TestArtworkType(t *testing.T) {
	cases := []struct {
		name       string
		photoCount int
		animated   bool
		want       string
	}{
		{name: "animated", photoCount: 1, animated: true, want: "ugoira"},
		{name: "manga", photoCount: 2, animated: false, want: "manga"},
		{name: "illust", photoCount: 1, animated: false, want: "illust"},
	}
	for _, tt := range cases {
		t.Run(tt.name, func(t *testing.T) {
			if got := artworkType(tt.photoCount, tt.animated); got != tt.want {
				t.Fatalf("artworkType() = %q, want %q", got, tt.want)
			}
		})
	}
}
