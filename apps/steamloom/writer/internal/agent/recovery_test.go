package agent

import (
	"path/filepath"
	"testing"
)

func TestRecoverInterruptedApplyIsDurableAndIdempotent(t *testing.T) {
	withTempConfig(t)
	page, err := NewChat("claude", "project")
	if err != nil {
		t.Fatal(err)
	}
	originalTaskID, _ := newThreadID()
	proposal, err := SaveProposal("claude", "project", page.CurrentID, originalTaskID, "", []ProposalItem{{
		Kind: ProposalKindLore, Title: "角色 A", Content: "設定",
		Operations: []ProposalOperation{{Tool: "storyteller_upsert_lore", Arguments: map[string]any{
			"project_public_id": "project", "title": "角色 A", "content": "設定",
		}}},
	}})
	if err != nil {
		t.Fatal(err)
	}
	proposal, err = DecideProposal("claude", "project", page.CurrentID, proposal.ID, ProposalDecisionApprove)
	if err != nil {
		t.Fatal(err)
	}
	applyTaskID, _ := newThreadID()
	applying, err := recordApplyStarted("claude", "project", page.CurrentID, proposal.ID, applyTaskID)
	if err != nil || applying.Status != ProposalApplying || applying.GrantID == "" {
		t.Fatalf("apply did not start: %#v, %v", applying, err)
	}

	if err := RecoverInterruptedApplies("project"); err != nil {
		t.Fatal(err)
	}
	if err := RecoverInterruptedApplies("project"); err != nil {
		t.Fatalf("second recovery must be idempotent: %v", err)
	}
	proposals, err := Proposals("claude", "project", page.CurrentID)
	if err != nil || len(proposals) != 1 || proposals[0].Status != ProposalVerificationRequired || proposals[0].GrantID != "" {
		t.Fatalf("interrupted proposal was not invalidated: %#v, %v", proposals, err)
	}
	threads, err := ProjectThreads("project")
	if err != nil || len(threads) != 1 || threads[0].LastTaskState != TaskVerificationRequired {
		t.Fatalf("thread did not restore verification state: %#v, %v", threads, err)
	}
	dir, _, err := loadChat("claude", "project")
	if err != nil {
		t.Fatal(err)
	}
	events, err := readLines(filepath.Join(dir, page.CurrentID+".jsonl"))
	if err != nil {
		t.Fatal(err)
	}
	count := 0
	for _, event := range events {
		if event.Type == EventApplyInterrupted && event.ProposalID == proposal.ID {
			count++
		}
	}
	if count != 1 {
		t.Fatalf("expected one durable interruption event, got %d", count)
	}
}
