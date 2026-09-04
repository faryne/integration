package storyteller

import (
	"strings"
	"testing"
)

func TestBackfillStoryMarkerIdsCodeBlock(t *testing.T) {
	content := strings.Join([]string{
		"```go",
		"⟦not-a-paragraph⟧literal marker⟦/not-a-paragraph⟧",
		"fmt.Println(\"hi\")",
		"```",
		"⟦p1⟧後文⟦/p1⟧",
	}, "\n")

	got := backfillStoryMarkerIds(content)
	lines := strings.Split(got, "\n")
	if !strings.HasPrefix(lines[0], "```go id=\"") {
		t.Fatalf("code fence opening = %q, want id attr", lines[0])
	}
	if lines[1] != "⟦not-a-paragraph⟧literal marker⟦/not-a-paragraph⟧" {
		t.Fatalf("code content line was rewritten: %q", lines[1])
	}
	if lines[4] != "⟦p1⟧後文⟦/p1⟧" {
		t.Fatalf("existing paragraph marker changed: %q", lines[4])
	}
}

func TestGroupStoryLinesCodeBlockBookmarkPreview(t *testing.T) {
	content := strings.Join([]string{
		"⟦p1⟧前文⟦/p1⟧",
		"```json id=\"code_1\"",
		"{\"ok\":true}",
		"```",
	}, "\n")

	groups := groupStoryLinesByBlockKind(content)
	if len(groups) != 2 {
		t.Fatalf("len(groups) = %d, want 2", len(groups))
	}
	if groups[1].blockKind != storyBlockKindCode || groups[1].startIndex != 1 {
		t.Fatalf("code group = %#v", groups[1])
	}
	if got, want := storyBookmarkLinePreview(groups, "1"), "{\"ok\":true}"; got != want {
		t.Fatalf("storyBookmarkLinePreview() = %q, want %q", got, want)
	}
}
