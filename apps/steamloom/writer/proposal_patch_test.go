package main

import (
	"context"
	"strings"
	"testing"

	"faryne.dev/apps/steamloom/writer/internal/agent"
	"faryne.dev/apps/steamloom/writer/internal/api"
)

func TestApplyProposalEditsRunsInOrder(t *testing.T) {
	got, err := applyProposalEdits("梭梭說：梭梭在這裡。\n第二段", []agent.ProposalEdit{
		{Find: "梭梭", Replace: "那頭", All: true},
		{Find: "第二段", Replace: "第二段（改）"},
	})
	if err != nil || got != "那頭說：那頭在這裡。\n第二段（改）" {
		t.Fatalf("unexpected patch result: %q, %v", got, err)
	}
}

func TestApplyProposalEditsRejectsMissingAndAmbiguousFind(t *testing.T) {
	cases := map[string][]agent.ProposalEdit{
		"找不到":    {{Find: "不存在", Replace: "x"}},
		"出現 2 次": {{Find: "重複", Replace: "x"}},
	}
	for want, edits := range cases {
		if _, err := applyProposalEdits("重複、重複", edits); err == nil || !strings.Contains(err.Error(), want) {
			t.Fatalf("expected %q error, got %v", want, err)
		}
	}
}

func TestPreparePatchProposalBuildsFullContentFromBase(t *testing.T) {
	latest := uint64(42)
	items, err := prepareProposalItems(context.Background(), fakeProposalSource{document: &api.Document{
		Title: "第一話", Summary: "原摘要", ContentType: "text", Content: "梭梭醒了。", LatestVersionID: &latest,
	}}, "project", []agent.ProposalItem{{
		ProposalType: agent.ProposalTypeDocumentPatch, Kind: agent.ProposalKindStory, TargetID: "story-1", BaseVersionID: "42",
		Edits: []agent.ProposalEdit{{Find: "梭梭", Replace: "那頭"}},
	}})
	if err != nil {
		t.Fatal(err)
	}
	item := items[0]
	if item.Content != "那頭醒了。" || item.Title != "第一話" || item.Summary != "原摘要" || item.Base == nil || item.Base.Content != "梭梭醒了。" {
		t.Fatalf("patch proposal not expanded from base: %#v", item)
	}
}
