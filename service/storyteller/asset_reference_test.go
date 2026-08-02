package storyteller

import (
	"reflect"
	"testing"
)

func TestAssetPublicIDsFromMarkdown(t *testing.T) {
	content := "![a](steamloom-asset://asset-a)\n重複 steamloom-asset://asset-a\n![b](steamloom-asset://asset_b-2)"
	got := assetPublicIDsFromMarkdown(content)
	want := []string{"asset-a", "asset_b-2"}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("assetPublicIDsFromMarkdown() = %#v, want %#v", got, want)
	}
}
