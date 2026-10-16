package main

import (
	"context"
	"fmt"
	"testing"

	"faryne.dev/apps/steamloom/writer/internal/agent"
	"faryne.dev/apps/steamloom/writer/internal/api"
)

type fakeProposalSource struct {
	document *api.Document
	versions map[string]*api.VersionDetail
}

func (f fakeProposalSource) Document(context.Context, string, api.DocumentKind, string) (*api.Document, error) {
	return f.document, nil
}

func (f fakeProposalSource) VersionDetail(_ context.Context, _ string, _ api.DocumentKind, _, versionID string) (*api.VersionDetail, error) {
	version := f.versions[versionID]
	if version == nil {
		return nil, fmt.Errorf("missing version %s", versionID)
	}
	return version, nil
}

func TestPrepareProposalFillsCurrentBaseFromWriterAPI(t *testing.T) {
	latest := uint64(42)
	items, err := prepareProposalItems(context.Background(), fakeProposalSource{document: &api.Document{
		Title: "角色 A", Summary: "摘要", ContentType: "text", Content: "舊內容", LatestVersionID: &latest,
	}}, "project", []agent.ProposalItem{{
		Kind: agent.ProposalKindLore, TargetID: "lore-1", Title: "角色 A", Content: "新內容",
		Operations: []agent.ProposalOperation{{Tool: "storyteller_upsert_lore", Arguments: map[string]any{"project_public_id": "project", "lore_public_id": "lore-1"}}},
	}})
	if err != nil {
		t.Fatal(err)
	}
	item := items[0]
	if item.BaseVersionID != "42" || item.Base == nil || item.Base.Content != "舊內容" || fmt.Sprint(item.Operations[0].Arguments["base_version_id"]) != "42" {
		t.Fatalf("Writer did not fill authoritative base: %#v", item)
	}
}

func TestPrepareProposalLoadsAgentReferencedHistoricalBase(t *testing.T) {
	latest := uint64(42)
	items, err := prepareProposalItems(context.Background(), fakeProposalSource{
		document: &api.Document{Title: "角色 A", ContentType: "text", Content: "目前內容", LatestVersionID: &latest},
		versions: map[string]*api.VersionDetail{"41": {ID: 41, Title: "角色 A", Content: "Agent 讀取的內容"}},
	}, "project", []agent.ProposalItem{{
		Kind: agent.ProposalKindLore, TargetID: "lore-1", BaseVersionID: "41", Title: "角色 A", Content: "新內容",
		Operations: []agent.ProposalOperation{{Tool: "storyteller_upsert_lore", Arguments: map[string]any{"project_public_id": "project", "lore_public_id": "lore-1", "base_version_id": 41}}},
	}})
	if err != nil {
		t.Fatal(err)
	}
	if items[0].Base == nil || items[0].Base.Content != "Agent 讀取的內容" {
		t.Fatalf("Writer did not load historical base: %#v", items[0])
	}
}

func TestPrepareProposalScopesChapterBaseAndPreservesMetadata(t *testing.T) {
	latest := uint64(42)
	items, err := prepareProposalItems(context.Background(), fakeProposalSource{document: &api.Document{
		Title: "第一話", Summary: "原摘要", ContentType: "text", LatestVersionID: &latest,
		Content: "# ⟦one⟧第一章⟦/one⟧\n舊內容\n\n# ⟦two⟧第二章⟦/two⟧\n保留內容",
	}}, "project", []agent.ProposalItem{{
		ProposalType: agent.ProposalTypeChapterReplace, Kind: agent.ProposalKindStory, TargetID: "story-1", MarkerID: "one",
		Content: "# ⟦one⟧第一章⟦/one⟧\n新內容",
	}})
	if err != nil {
		t.Fatal(err)
	}
	item := items[0]
	if item.Title != "第一話" || item.Summary != "原摘要" || item.Base == nil || item.Base.Content != "# ⟦one⟧第一章⟦/one⟧\n舊內容\n" {
		t.Fatalf("chapter proposal did not preserve metadata or scope base: %#v", item)
	}
}
