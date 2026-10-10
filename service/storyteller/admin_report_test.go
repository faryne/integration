package storyteller

import (
	"strings"
	"testing"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

func TestReasonCounts(t *testing.T) {
	got := reasonCounts([]storytellerModel.Report{{ReasonKey: "spam"}, {ReasonKey: "harassment"}, {ReasonKey: "spam"}, {ReasonKey: "copyright"}})
	want := []storytellerModel.AdminReasonCount{{Key: "spam", Count: 2}, {Key: "copyright", Count: 1}, {Key: "harassment", Count: 1}}
	if len(got) != len(want) {
		t.Fatalf("got %v", got)
	}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("index %d: got %v, want %v", i, got[i], want[i])
		}
	}
}

func TestAdminExcerpt(t *testing.T) {
	if got := adminExcerpt("  第一行\n第二行  [spoiler]劇透[/spoiler] "); got != "第一行 第二行 [spoiler]劇透[/spoiler]" {
		t.Fatalf("got %q", got)
	}
	if got := adminExcerpt(strings.Repeat("字", adminExcerptRunes+5)); !strings.HasSuffix(got, "…") || len([]rune(got)) != adminExcerptRunes+1 {
		t.Fatalf("long excerpt not truncated: %q", got)
	}
}
