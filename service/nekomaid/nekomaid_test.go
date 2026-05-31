package nekomaid

import (
	"testing"

	"faryne.dev/model/enum"
)

func TestNekomaidObjectKey(t *testing.T) {
	got := nekomaidObjectKey(enum.NekomaidSitePixiv, "82517969", "145304494_a803d.jpg")
	want := "pixiv/82517969/145304494_a803d.jpg"
	if got != want {
		t.Fatalf("object key = %q, want %q", got, want)
	}
}

func TestNekomaidThumbObjectKey(t *testing.T) {
	got := nekomaidThumbObjectKey(enum.NekomaidSitePixiv, "82517969", "145304494_a803d_thumb.jpg")
	want := "thumb/pixiv/82517969/145304494_a803d_thumb.jpg"
	if got != want {
		t.Fatalf("thumb object key = %q, want %q", got, want)
	}
}

func TestS3KeyFromURL(t *testing.T) {
	got := s3KeyFromURL("https://pcdn1.ha2.tw/thumb/pixiv/82517969/145304494_a803d_thumb.jpg")
	want := "thumb/pixiv/82517969/145304494_a803d_thumb.jpg"
	if got != want {
		t.Fatalf("s3 key from URL = %q, want %q", got, want)
	}
}

func TestCleanS3PathSegment(t *testing.T) {
	got := nekomaidObjectKey(enum.NekomaidSitePixiv, "/author/id/", "file/name.jpg")
	want := "pixiv/author_id/file_name.jpg"
	if got != want {
		t.Fatalf("cleaned object key = %q, want %q", got, want)
	}
}
