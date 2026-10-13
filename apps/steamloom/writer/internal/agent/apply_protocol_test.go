package agent

import (
	"errors"
	"strings"
	"testing"
)

func TestParseApplyResultEnvelopeBindsProposalHash(t *testing.T) {
	grant := ApprovalGrant{ProposalID: "proposal-1", ContentHash: strings.Repeat("a", 64)}
	answer := "已更新角色設定。\n" + applyEnvelopeStart + `
{"proposal_id":"proposal-1","content_hash":"` + grant.ContentHash + `","status":"completed"}
` + applyEnvelopeEnd
	visible, result, err := parseApplyResultEnvelope(answer, grant)
	if err != nil || visible != "已更新角色設定。" || result == nil || result.Status != "completed" {
		t.Fatalf("unexpected apply result: %q %#v %v", visible, result, err)
	}
	if _, _, err := parseApplyResultEnvelope(strings.Replace(answer, grant.ContentHash, strings.Repeat("b", 64), 1), grant); err == nil {
		t.Fatal("apply result with another content hash was accepted")
	}
}

func TestVerifyApplyReplyClassifiesVersionConflict(t *testing.T) {
	grant := ApprovalGrant{ProposalID: "proposal-1", ContentHash: strings.Repeat("a", 64)}
	err := verifyApplyReply(grant, Reply{applyResult: &ApplyResult{
		ProposalID: grant.ProposalID, ContentHash: grant.ContentHash, Status: "conflict", Error: "latest version is 42",
	}}, nil)
	if !errors.Is(err, errApplyConflict) {
		t.Fatalf("version conflict was not classified: %v", err)
	}
}

func TestApprovalGrantExposesOnlyApprovedMutationTools(t *testing.T) {
	proposal := Proposal{
		ID: "proposal-1", ProjectID: "project", Status: ProposalApplying, ContentHash: strings.Repeat("a", 64), GrantID: "grant-1", GrantExpiresAt: "2026-10-13T12:00:00+08:00",
		Items: []ProposalItem{{Kind: ProposalKindLore, Operations: []ProposalOperation{{Tool: "storyteller_upsert_lore"}, {Tool: "storyteller_update_lore_collection"}}}},
	}
	grant, err := newApprovalGrant(proposal)
	if err != nil {
		t.Fatal(err)
	}
	joined := strings.Join(grant.Tools, ",")
	if joined != "storyteller_update_lore_collection,storyteller_upsert_lore" || strings.Contains(joined, "get_lore") {
		t.Fatalf("grant tool scope is wrong: %s", joined)
	}
}

func TestApprovalGrantUsesNarrowAssetMCP(t *testing.T) {
	grant, err := newApprovalGrant(Proposal{AgentID: "grok", ProjectID: "project", ThreadID: "thread", ID: "proposal", Status: ProposalApplying, GrantID: "grant", GrantExpiresAt: "soon", Items: []ProposalItem{{Kind: ProposalKindAsset}}})
	if err != nil || grant.AssetTool != assetMCPToolName || grant.assetMCP == nil || grant.assetMCP.Args[0] != "--asset-mcp" {
		t.Fatalf("asset grant did not create scoped MCP: %#v, %v", grant, err)
	}
}
