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
	if err != nil || applying.Status != ProposalApplying {
		t.Fatalf("apply did not start: %#v, %v", applying, err)
	}

	if err := RecoverInterruptedApplies("project", nil); err != nil {
		t.Fatal(err)
	}
	if err := RecoverInterruptedApplies("project", nil); err != nil {
		t.Fatalf("second recovery must be idempotent: %v", err)
	}
	proposals, err := Proposals("claude", "project", page.CurrentID)
	if err != nil || len(proposals) != 1 || proposals[0].Status != ProposalVerificationRequired {
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
	confirmed, err := ConfirmProposalApplied("claude", "project", page.CurrentID, proposal.ID)
	if err != nil || confirmed.Status != ProposalApplied {
		t.Fatalf("confirmed apply was not persisted: %#v, %v", confirmed, err)
	}
	if _, err := ConfirmProposalApplied("claude", "project", page.CurrentID, proposal.ID); err != nil {
		t.Fatalf("confirming an applied proposal must be idempotent: %v", err)
	}
	threads, err = ProjectThreads("project")
	if err != nil || threads[0].LastTaskState != TaskApplied {
		t.Fatalf("confirmed thread did not become applied: %#v, %v", threads, err)
	}
}

func TestRecoverInterruptedApplySkipsActiveTask(t *testing.T) {
	withTempConfig(t)
	page, err := NewChat("claude", "project")
	if err != nil {
		t.Fatal(err)
	}
	taskID, _ := newThreadID()
	proposal, err := SaveProposal("claude", "project", page.CurrentID, taskID, "", []ProposalItem{{
		Kind: ProposalKindStory, Title: "新故事", Content: "內容",
		Operations: []ProposalOperation{{Tool: "storyteller_upsert_story", Arguments: map[string]any{
			"project_public_id": "project", "title": "新故事", "content": "內容",
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
	if _, err := recordApplyStarted("claude", "project", page.CurrentID, proposal.ID, applyTaskID); err != nil {
		t.Fatal(err)
	}
	if err := RecoverInterruptedApplies("project", map[string]bool{applyTaskID: true}); err != nil {
		t.Fatal(err)
	}
	proposals, err := Proposals("claude", "project", page.CurrentID)
	if err != nil || len(proposals) != 1 || proposals[0].Status != ProposalApplying {
		t.Fatalf("active apply was incorrectly recovered: %#v, %v", proposals, err)
	}
}

func TestLateRESTSuccessRepairsPrematureInterruption(t *testing.T) {
	withTempConfig(t)
	page, err := NewChat("claude", "project")
	if err != nil {
		t.Fatal(err)
	}
	originalTaskID, _ := newThreadID()
	proposal, err := SaveProposal("claude", "project", page.CurrentID, originalTaskID, "", []ProposalItem{{
		Kind: ProposalKindStory, Title: "新故事", Content: "內容",
		Operations: []ProposalOperation{{Tool: "storyteller_upsert_story", Arguments: map[string]any{"project_public_id": "project", "title": "新故事", "content": "內容"}}},
	}})
	if err != nil {
		t.Fatal(err)
	}
	proposal, err = DecideProposal("claude", "project", page.CurrentID, proposal.ID, ProposalDecisionApprove)
	if err != nil {
		t.Fatal(err)
	}
	applyTaskID, _ := newThreadID()
	if _, err := recordApplyStarted("claude", "project", page.CurrentID, proposal.ID, applyTaskID); err != nil {
		t.Fatal(err)
	}
	if err := RecoverInterruptedApplies("project", nil); err != nil {
		t.Fatal(err)
	}
	completed, err := recordApplyCompleted("claude", "project", page.CurrentID, proposal.ID, applyTaskID, "Writer 已收到 REST API 的成功結果。")
	if err != nil || completed.Status != ProposalApplied {
		t.Fatalf("late REST success did not repair interruption: %#v, %v", completed, err)
	}
}
