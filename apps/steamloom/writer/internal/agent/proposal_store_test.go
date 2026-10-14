package agent

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestSaveProposalPersistsBatchHashesAndReadyEvent(t *testing.T) {
	withTempConfig(t)
	page, err := NewChat("claude", "project")
	if err != nil {
		t.Fatal(err)
	}
	taskID, _ := newThreadID()
	items := []ProposalItem{
		{
			Kind: ProposalKindStory, Operations: []ProposalOperation{{Tool: "storyteller_upsert_story", Arguments: map[string]any{"content": "新內容", "project_public_id": "project", "story_public_id": "story-1", "base_version_id": 42}}}, TargetID: "story-1", BaseVersionID: "42",
			Title: "第一話", Content: "新內容", Base: &ProposalSnapshot{Title: "第一話", ContentType: "text", Content: "舊內容"},
		},
		{
			Kind: ProposalKindLore, Operations: []ProposalOperation{{Tool: "storyteller_upsert_lore", Arguments: map[string]any{"content": "角色設定", "project_public_id": "project", "title": "角色 A"}}}, Title: "角色 A", Content: "角色設定",
		},
	}
	proposal, err := SaveProposal("claude", "project", page.CurrentID, taskID, "", items)
	if err != nil {
		t.Fatal(err)
	}
	if proposal.Status != ProposalAwaitingConfirmation || len(proposal.ContentHash) != 64 || len(proposal.Items) != 2 {
		t.Fatalf("unexpected proposal: %#v", proposal)
	}
	for _, item := range proposal.Items {
		if len(item.ContentHash) != 64 || item.ID == "" {
			t.Fatalf("proposal item was not sealed: %#v", item)
		}
	}

	stored, err := Proposals("claude", "project", page.CurrentID)
	if err != nil {
		t.Fatal(err)
	}
	if len(stored) != 1 || stored[0].ID != proposal.ID || stored[0].ContentHash != proposal.ContentHash {
		t.Fatalf("proposal did not round-trip: %#v", stored)
	}
	chat, err := OpenChat("claude", "project")
	if err != nil {
		t.Fatal(err)
	}
	ready := chat.Messages[len(chat.Messages)-1]
	if ready.Type != EventProposalReady || ready.ProposalID != proposal.ID || ready.TaskID != taskID {
		t.Fatalf("proposal.ready was not persisted: %#v", ready)
	}
	threads, err := ProjectThreads("project")
	if err != nil {
		t.Fatal(err)
	}
	if len(threads) != 1 || threads[0].LastTaskState != TaskAwaitingConfirmation {
		t.Fatalf("thread did not restore pending state: %#v", threads)
	}
	decided, err := DecideProposal("claude", "project", page.CurrentID, proposal.ID, ProposalDecisionReject)
	if err != nil || decided.Status != ProposalRejected || decided.DecidedAt == "" {
		t.Fatalf("proposal was not rejected: %#v, %v", decided, err)
	}
	if _, err := DecideProposal("claude", "project", page.CurrentID, proposal.ID, ProposalDecisionReject); err != nil {
		t.Fatalf("same decision must be idempotent: %v", err)
	}
	if _, err := DecideProposal("claude", "project", page.CurrentID, proposal.ID, ProposalDecisionApprove); err == nil {
		t.Fatal("opposite decision was accepted")
	}
	chat, err = OpenChat("claude", "project")
	if err != nil {
		t.Fatal(err)
	}
	decisionEvents := 0
	for _, event := range chat.Messages {
		if event.Type == EventProposalRejected {
			decisionEvents++
			if event.ProposalID != proposal.ID || event.ContentHash != proposal.ContentHash {
				t.Fatalf("decision audit fields missing: %#v", event)
			}
		}
	}
	if decisionEvents != 1 {
		t.Fatalf("expected one durable decision event, got %d", decisionEvents)
	}
	stored, err = Proposals("claude", "project", page.CurrentID)
	if err != nil || len(stored) != 1 || stored[0].Status != ProposalRejected {
		t.Fatalf("decision did not survive reload: %#v, %v", stored, err)
	}
	threads, err = ProjectThreads("project")
	if err != nil || len(threads) != 1 || threads[0].LastTaskState != TaskRejected {
		t.Fatalf("thread restored stale proposal state: %#v, %v", threads, err)
	}
}

func TestApproveProposalPersistsSelectedItems(t *testing.T) {
	withTempConfig(t)
	page, err := NewChat("claude", "project")
	if err != nil {
		t.Fatal(err)
	}
	taskID, _ := newThreadID()
	proposal, err := SaveProposal("claude", "project", page.CurrentID, taskID, "", []ProposalItem{
		{Kind: ProposalKindLore, Title: "角色 A", Content: "A", Operations: []ProposalOperation{{Tool: "storyteller_upsert_lore", Arguments: map[string]any{"project_public_id": "project"}}}},
		{Kind: ProposalKindLore, Title: "角色 B", Content: "B", Operations: []ProposalOperation{{Tool: "storyteller_upsert_lore", Arguments: map[string]any{"project_public_id": "project"}}}},
	})
	if err != nil {
		t.Fatal(err)
	}
	selected := proposal.Items[1].ID
	approved, err := DecideProposal("claude", "project", page.CurrentID, proposal.ID, ProposalDecisionApprove, []string{selected})
	if err != nil {
		t.Fatal(err)
	}
	if len(approved.SelectedItemIDs) != 1 || approved.SelectedItemIDs[0] != selected || len(approved.ApplyItems()) != 1 || approved.ApplyItems()[0].Title != "角色 B" {
		t.Fatalf("selected items were not sealed into the decision: %#v", approved)
	}
	stored, err := ProposalByID("claude", "project", page.CurrentID, proposal.ID)
	if err != nil || len(stored.SelectedItemIDs) != 1 || stored.SelectedItemIDs[0] != selected {
		t.Fatalf("selected items did not survive reload: %#v, %v", stored, err)
	}
}

func TestSaveProposalStagesAssetAndDeleteChatRemovesIt(t *testing.T) {
	root := withTempConfig(t)
	page, err := NewChat("grok", "project")
	if err != nil {
		t.Fatal(err)
	}
	assetRoot := t.TempDir()
	source := filepath.Join(assetRoot, "cover.png")
	if err := os.WriteFile(source, []byte("fake png bytes"), 0o600); err != nil {
		t.Fatal(err)
	}
	taskID, _ := newThreadID()
	proposal, err := SaveProposal("grok", "project", page.CurrentID, taskID, assetRoot, []ProposalItem{{
		Kind: ProposalKindAsset, Operations: []ProposalOperation{
			{Tool: "storyteller_presign_asset_upload", Arguments: map[string]any{"content_type": "image/png", "project_public_id": "project"}},
			{Tool: "storyteller_confirm_asset_upload", Arguments: map[string]any{"project_public_id": "project", "title": "封面"}},
		},
		LocalPath: source, MIMEType: "image/png", FileName: "封面.png", AltText: "霧中的郵差",
	}})
	if err != nil {
		t.Fatal(err)
	}
	item := proposal.Items[0]
	if item.LocalPath == source || item.FileSize != int64(len("fake png bytes")) || len(item.FileSHA256) != 64 {
		t.Fatalf("asset was not staged: %#v", item)
	}
	if raw, err := os.ReadFile(item.LocalPath); err != nil || string(raw) != "fake png bytes" {
		t.Fatalf("staged asset mismatch: %q, %v", raw, err)
	}
	preview, err := ProposalAssetPreview("grok", "project", page.CurrentID, proposal.ID, item.ID)
	if err != nil || !strings.HasPrefix(preview, "data:image/png;base64,") {
		t.Fatalf("asset preview failed: %q, %v", preview, err)
	}
	if err := os.WriteFile(item.LocalPath, []byte("tampered"), 0o600); err != nil {
		t.Fatal(err)
	}
	if _, err := ProposalAssetPreview("grok", "project", page.CurrentID, proposal.ID, item.ID); err == nil {
		t.Fatal("tampered proposal asset was previewed")
	}
	if _, err := DecideProposal("grok", "project", page.CurrentID, proposal.ID, ProposalDecisionApprove); err == nil {
		t.Fatal("tampered proposal asset was approved")
	}
	if _, err := DeleteChat("grok", "project", page.CurrentID); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(filepath.Join(root, "SteamLoom Writer", "chats", "grok", "project", "proposals", page.CurrentID)); !os.IsNotExist(err) {
		t.Fatalf("proposal artifacts survived thread deletion: %v", err)
	}
}

func TestApproveProposalPersistsUserDecisionAndClearsPendingState(t *testing.T) {
	withTempConfig(t)
	page, err := NewChat("claude", "project")
	if err != nil {
		t.Fatal(err)
	}
	taskID, _ := newThreadID()
	proposal, err := SaveProposal("claude", "project", page.CurrentID, taskID, "", []ProposalItem{{
		Kind: ProposalKindLore, Title: "許芷瑄", Content: "新設定",
		Operations: []ProposalOperation{{Tool: "storyteller_upsert_lore", Arguments: map[string]any{"project_public_id": "project", "title": "許芷瑄", "content": "新設定"}}},
	}})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := DecideProposal("claude", "project", page.CurrentID, proposal.ID, ProposalDecisionApprove); err != nil {
		t.Fatal(err)
	}
	chat, err := OpenChat("claude", "project")
	if err != nil {
		t.Fatal(err)
	}
	decision := chat.Messages[len(chat.Messages)-1]
	if decision.Type != EventProposalApproved || decision.Role != "user" || !strings.Contains(decision.Text, "你已同意套用 1 項變更：設定〈許芷瑄〉") {
		t.Fatalf("approval was not persisted as a user decision: %#v", decision)
	}
	threads, err := ProjectThreads("project")
	if err != nil || len(threads) != 1 || threads[0].LastTaskState != TaskApproved {
		t.Fatalf("approved proposal remained pending: %#v, %v", threads, err)
	}
}

func TestSaveProposalRejectsUnsafeScopeAndIncompleteBase(t *testing.T) {
	withTempConfig(t)
	page, err := NewChat("codex", "project")
	if err != nil {
		t.Fatal(err)
	}
	taskID, _ := newThreadID()
	tests := []ProposalItem{
		{Kind: ProposalKindStory, Operations: []ProposalOperation{{Tool: "storyteller_get_story", Arguments: map[string]any{"project_public_id": "project"}}}, Content: "內容"},
		{Kind: ProposalKindLore, Operations: []ProposalOperation{{Tool: "storyteller_upsert_lore", Arguments: map[string]any{"project_public_id": "other"}}}, Content: "內容"},
		{Kind: ProposalKindStory, Operations: []ProposalOperation{{Tool: "storyteller_upsert_story", Arguments: map[string]any{"project_public_id": "project"}}}, TargetID: "story-1", Content: "內容"},
		{Kind: ProposalKindStory, Operations: []ProposalOperation{{Tool: "storyteller_upsert_lore", Arguments: map[string]any{"project_public_id": "project"}}}, Content: "內容"},
		{Kind: ProposalKindLore, Operations: []ProposalOperation{{Tool: "storyteller_upsert_lore", Arguments: map[string]any{"project_public_id": "project", "lore_public_id": "lore-2"}}}, TargetID: "lore-1", BaseVersionID: "42", Base: &ProposalSnapshot{Content: "舊內容"}, Content: "新內容"},
		{Kind: ProposalKindStory, Operations: []ProposalOperation{{Tool: "storyteller_upsert_story", Arguments: map[string]any{"base_version_id": 43, "project_public_id": "project", "story_public_id": "story-1"}}}, TargetID: "story-1", BaseVersionID: "42", Base: &ProposalSnapshot{Content: "舊內容"}, Content: "新內容"},
	}
	for index, item := range tests {
		if _, err := SaveProposal("codex", "project", page.CurrentID, taskID, "", []ProposalItem{item}); err == nil {
			t.Fatalf("unsafe proposal %d was accepted", index)
		}
	}
	stored, err := Proposals("codex", "project", page.CurrentID)
	if err != nil || len(stored) != 0 {
		t.Fatalf("rejected proposal left payloads behind: %#v, %v", stored, err)
	}
}

func TestSaveProposalKeepsReviewedFieldsSeparateFromOperationAudit(t *testing.T) {
	withTempConfig(t)
	page, err := NewChat("claude", "project")
	if err != nil {
		t.Fatal(err)
	}
	taskID, _ := newThreadID()
	proposal, err := SaveProposal("claude", "project", page.CurrentID, taskID, "", []ProposalItem{{
		Kind: ProposalKindStory, Title: "作者看到的標題", Summary: "作者看到的摘要", ContentType: "text", Content: "作者看到的正文",
		Operations: []ProposalOperation{{Tool: "storyteller_upsert_story", Arguments: map[string]any{
			"project_public_id": "project", "title": "隱藏標題", "summary": "隱藏摘要", "content_type": "markdown", "content": "隱藏正文",
		}}},
	}})
	if err != nil {
		t.Fatal(err)
	}
	arguments := proposal.Items[0].Operations[0].Arguments
	for key, want := range map[string]string{"title": "隱藏標題", "summary": "隱藏摘要", "content_type": "markdown", "content": "隱藏正文"} {
		if got := arguments[key]; got != want {
			t.Fatalf("operation audit %s changed unexpectedly: got %#v, want %q", key, got, want)
		}
	}
	if proposal.Items[0].Title != "作者看到的標題" || proposal.Items[0].Content != "作者看到的正文" {
		t.Fatalf("reviewed fields were not preserved independently: %#v", proposal.Items[0])
	}
}
