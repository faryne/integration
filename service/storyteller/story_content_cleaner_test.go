package storyteller

import "testing"

func TestStripBookmarkLineMarkerMasksAssetFilename(t *testing.T) {
	line := `⟦marker-1 align="center"⟧![814d869e-abbc-40f9-b84c-ff54d56fc748.png](steamloom-asset://asset-1)⟦/marker-1⟧`
	if got := stripBookmarkLineMarker(line); got != "（圖片）" {
		t.Fatalf("stripBookmarkLineMarker() = %q, want %q", got, "（圖片）")
	}
}

func TestPlainTextFromStoryContentKeepsAssetAltForSearch(t *testing.T) {
	content := `前文
⟦marker-1⟧![814d869e-abbc-40f9-b84c-ff54d56fc748.png](steamloom-asset://asset-1)⟦/marker-1⟧`
	want := "前文\n814d869e-abbc-40f9-b84c-ff54d56fc748.png"
	if got := plainTextFromStoryContent(content); got != want {
		t.Fatalf("plainTextFromStoryContent() = %q, want %q", got, want)
	}
}
