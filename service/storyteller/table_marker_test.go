package storyteller

import "testing"

func TestWordCountHandlesTableMarkerRows(t *testing.T) {
	content := "⟦table tableId=\"tbl_a\" rowId=\"row_1\"⟧| 角色 | 狀態 |⟦/table⟧\n" +
		"⟦table tableId=\"tbl_a\" rowId=\"row_2\"⟧| 莉亞 | **完成\\|確認** |⟦/table⟧"
	got := wordCount(content)
	want := uint(len([]rune("角色狀態莉亞完成|確認")))
	if got != want {
		t.Fatalf("wordCount() = %d, want %d", got, want)
	}
}

func TestStripBookmarkLineMarkerHandlesTableMarkerRow(t *testing.T) {
	line := `⟦table tableId="tbl_a" rowId="row_1"⟧| 莉亞 | --取消-- | C\\D | E\nF |⟦/table⟧`
	want := "莉亞 | 取消 | C\\D | E\nF"
	if got := stripBookmarkLineMarker(line); got != want {
		t.Fatalf("stripBookmarkLineMarker() = %q, want %q", got, want)
	}
}

func TestPlainTextFromStoryContentKeepsTableCellAssetAltForSearch(t *testing.T) {
	content := `⟦table tableId="tbl_a" rowId="row_1"⟧| 圖 | ![城堡](steamloom-asset://asset-1) |⟦/table⟧`
	want := "圖 | 城堡"
	if got := plainTextFromStoryContent(content); got != want {
		t.Fatalf("plainTextFromStoryContent() = %q, want %q", got, want)
	}
}

func TestStoryBookmarkLinePreviewLabelsTableGroup(t *testing.T) {
	content := "⟦table tableId=\"tbl_a\" rowId=\"row_1\"⟧| 角色 | 狀態 |⟦/table⟧\n" +
		"⟦table tableId=\"tbl_a\" rowId=\"row_2\"⟧| 莉亞 | **完成** |⟦/table⟧"
	groups := groupStoryLinesByBlockKind(content)
	want := "[表格] 角色 | 狀態 ⋯"
	if got := storyBookmarkLinePreview(groups, "0"); got != want {
		t.Fatalf("storyBookmarkLinePreview() = %q, want %q", got, want)
	}
}

func TestGroupStoryLinesByBlockKindGroupsAdjacentTableMarkerRows(t *testing.T) {
	content := "⟦table tableId=\"tbl_a\" rowId=\"row_1\"⟧| A | B |⟦/table⟧\n" +
		"⟦table tableId=\"tbl_a\" rowId=\"row_2\"⟧| 1 | 2 |⟦/table⟧\n" +
		"⟦p1⟧一般段落⟦/p1⟧\n" +
		"⟦table tableId=\"tbl_b\" rowId=\"row_1\"⟧| C | D |⟦/table⟧"
	groups := groupStoryLinesByBlockKind(content)
	if len(groups) != 3 {
		t.Fatalf("len(groups) = %d, want 3", len(groups))
	}
	if groups[0].blockKind != storyBlockKindTable || groups[0].startIndex != 0 || len(groups[0].lines) != 2 || groups[0].tableID != "tbl_a" {
		t.Fatalf("first group = %#v, want table tbl_a with 2 lines at index 0", groups[0])
	}
	if groups[2].blockKind != storyBlockKindTable || groups[2].startIndex != 3 || len(groups[2].lines) != 1 || groups[2].tableID != "tbl_b" {
		t.Fatalf("third group = %#v, want table tbl_b with 1 line at index 3", groups[2])
	}
}

func TestGroupStoryLinesByBlockKindDoesNotMergeMissingTableIDRows(t *testing.T) {
	content := "⟦table rowId=\"row_1\"⟧| A | B |⟦/table⟧\n" +
		"⟦table rowId=\"row_2\"⟧| 1 | 2 |⟦/table⟧"
	groups := groupStoryLinesByBlockKind(content)
	if len(groups) != 2 {
		t.Fatalf("len(groups) = %d, want 2", len(groups))
	}
	if groups[0].tableID == groups[1].tableID {
		t.Fatalf("missing tableId rows should use per-line fallback IDs, got %q", groups[0].tableID)
	}
}
