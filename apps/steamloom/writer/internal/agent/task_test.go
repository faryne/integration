package agent

import (
	"context"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestTaskManagerPersistsToolActivity(t *testing.T) {
	withTempConfig(t)
	page, err := NewChat("claude", "project")
	if err != nil {
		t.Fatal(err)
	}
	events := make(chan TaskEvent, 20)
	manager := NewTaskManager(context.Background(), func(_ context.Context, _ string, req Request) (Reply, error) {
		req.emitStream(StreamEvent{Type: StreamToolStarted, ToolName: "storyteller_get_story"})
		req.emitStream(StreamEvent{Type: StreamToolCompleted, ToolName: "storyteller_get_story"})
		return Reply{Text: "done"}, nil
	}, func(event TaskEvent) { events <- event })
	defer manager.Close()

	task, err := manager.Start("claude", Request{ThreadID: page.CurrentID, ProjectID: "project", Prompt: "read"})
	if err != nil {
		t.Fatal(err)
	}
	waitTaskEvent(t, events, task.ID, EventTaskCompleted)
	chat, err := OpenChat("claude", "project")
	if err != nil {
		t.Fatal(err)
	}
	var activity []ChatLine
	for _, line := range chat.Messages {
		if line.Type == EventTaskToolStarted || line.Type == EventTaskToolFinished {
			activity = append(activity, line)
		}
	}
	if len(activity) != 2 || activity[0].ToolName != "storyteller_get_story" || activity[1].ToolName != "storyteller_get_story" {
		t.Fatalf("tool activity was not persisted: %#v", activity)
	}
}

func TestTaskManagerPersistsLoginCommand(t *testing.T) {
	withTempConfig(t)
	page, err := NewChat("claude", "project")
	if err != nil {
		t.Fatal(err)
	}
	events := make(chan TaskEvent, 20)
	manager := NewTaskManager(context.Background(), func(context.Context, string, Request) (Reply, error) {
		return Reply{}, errors.New("Failed to authenticate: OAuth session expired and could not be refreshed")
	}, func(event TaskEvent) { events <- event })
	defer manager.Close()

	task, err := manager.Start("claude", Request{ThreadID: page.CurrentID, ProjectID: "project", Prompt: "read"})
	if err != nil {
		t.Fatal(err)
	}
	waitTaskEvent(t, events, task.ID, EventTaskFailed)
	chat, err := OpenChat("claude", "project")
	if err != nil {
		t.Fatal(err)
	}
	failed := chat.Messages[len(chat.Messages)-1]
	if failed.Action != "agent.login" || len(failed.Commands) != 1 || failed.Commands[0] != "claude auth login" {
		t.Fatalf("login action was not persisted: %#v", failed)
	}
}

func TestTaskManagerRunsDifferentThreadsConcurrently(t *testing.T) {
	withTempConfig(t)
	first, err := NewChat("codex", "project")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := SaveTurn("codex", "project", first.CurrentID, "seed", "seed", "session-one"); err != nil {
		t.Fatal(err)
	}
	second, err := NewChat("codex", "project")
	if err != nil {
		t.Fatal(err)
	}

	started := make(chan string, 2)
	release := make(chan struct{}, 2)
	events := make(chan TaskEvent, 20)
	manager := NewTaskManager(context.Background(), func(_ context.Context, _ string, req Request) (Reply, error) {
		started <- req.ThreadID
		<-release
		return Reply{SessionID: "session-" + req.ThreadID, Text: "done"}, nil
	}, func(event TaskEvent) { events <- event })
	defer manager.Close()

	one, err := manager.Start("codex", Request{ThreadID: first.CurrentID, ProjectID: "project", Prompt: "one"})
	if err != nil {
		t.Fatal(err)
	}
	two, err := manager.Start("codex", Request{ThreadID: second.CurrentID, ProjectID: "project", Prompt: "two"})
	if err != nil {
		t.Fatal(err)
	}
	seen := map[string]bool{}
	for len(seen) < 2 {
		select {
		case id := <-started:
			seen[id] = true
		case <-time.After(time.Second):
			t.Fatal("different threads did not start concurrently")
		}
	}
	release <- struct{}{}
	release <- struct{}{}
	waitTaskEvents(t, events, EventTaskCompleted, one.ID, two.ID)
}

func TestTaskManagerSerializesSameThreadAndUsesLatestSession(t *testing.T) {
	withTempConfig(t)
	page, err := NewChat("claude", "project")
	if err != nil {
		t.Fatal(err)
	}
	started := make(chan Request, 2)
	release := make(chan struct{}, 2)
	events := make(chan TaskEvent, 20)
	manager := NewTaskManager(context.Background(), func(_ context.Context, _ string, req Request) (Reply, error) {
		started <- req
		<-release
		return Reply{SessionID: "session-" + req.Prompt, Text: "done " + req.Prompt}, nil
	}, func(event TaskEvent) { events <- event })
	defer manager.Close()

	first, err := manager.Start("claude", Request{ThreadID: page.CurrentID, ProjectID: "project", Prompt: "first"})
	if err != nil {
		t.Fatal(err)
	}
	second, err := manager.Start("claude", Request{ThreadID: page.CurrentID, ProjectID: "project", Prompt: "second"})
	if err != nil {
		t.Fatal(err)
	}
	firstReq := <-started
	if firstReq.Prompt != "first" {
		t.Fatalf("unexpected first task: %q", firstReq.Prompt)
	}
	select {
	case req := <-started:
		t.Fatalf("second task started too early: %q", req.Prompt)
	case <-time.After(100 * time.Millisecond):
	}
	release <- struct{}{}
	waitTaskEvent(t, events, first.ID, EventTaskCompleted)
	secondReq := <-started
	if secondReq.Prompt != "second" || secondReq.SessionID != "session-first" {
		t.Fatalf("second task did not resume latest session: %#v", secondReq)
	}
	release <- struct{}{}
	waitTaskEvent(t, events, second.ID, EventTaskCompleted)
}

func TestTaskManagerCancelsRunningTask(t *testing.T) {
	withTempConfig(t)
	page, err := NewChat("grok", "project")
	if err != nil {
		t.Fatal(err)
	}
	started := make(chan struct{}, 1)
	events := make(chan TaskEvent, 20)
	manager := NewTaskManager(context.Background(), func(ctx context.Context, _ string, req Request) (Reply, error) {
		req.emitStream(StreamEvent{Type: StreamAssistantDelta, Text: "尚未完成的回答"})
		started <- struct{}{}
		<-ctx.Done()
		return Reply{}, ctx.Err()
	}, func(event TaskEvent) { events <- event })
	defer manager.Close()

	task, err := manager.Start("grok", Request{ThreadID: page.CurrentID, ProjectID: "project", Prompt: "cancel me"})
	if err != nil {
		t.Fatal(err)
	}
	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("task did not start")
	}
	if err := manager.Cancel(task.ID); err != nil {
		t.Fatal(err)
	}
	waitTaskEvent(t, events, task.ID, EventTaskCanceled)
	chat, err := OpenChat("grok", "project")
	if err != nil {
		t.Fatal(err)
	}
	if got := chat.Messages[len(chat.Messages)-1].Type; got != EventTaskCanceled {
		t.Fatalf("cancel event was not persisted: %s", got)
	}
	if partial := chat.Messages[len(chat.Messages)-2]; partial.Type != EventMessagePartial || partial.Text != "尚未完成的回答" {
		t.Fatalf("partial answer was not persisted before cancel: %#v", partial)
	}
}

func TestTaskManagerCancelsQueuedTaskWithoutRunningIt(t *testing.T) {
	withTempConfig(t)
	page, err := NewChat("codex", "project")
	if err != nil {
		t.Fatal(err)
	}
	started := make(chan string, 2)
	release := make(chan struct{}, 1)
	events := make(chan TaskEvent, 20)
	manager := NewTaskManager(context.Background(), func(_ context.Context, _ string, req Request) (Reply, error) {
		started <- req.Prompt
		<-release
		return Reply{SessionID: "session", Text: "done"}, nil
	}, func(event TaskEvent) { events <- event })
	defer manager.Close()

	first, err := manager.Start("codex", Request{ThreadID: page.CurrentID, ProjectID: "project", Prompt: "first"})
	if err != nil {
		t.Fatal(err)
	}
	second, err := manager.Start("codex", Request{ThreadID: page.CurrentID, ProjectID: "project", Prompt: "second"})
	if err != nil {
		t.Fatal(err)
	}
	if got := <-started; got != "first" {
		t.Fatalf("unexpected running task: %q", got)
	}
	if err := manager.Cancel(second.ID); err != nil {
		t.Fatal(err)
	}
	waitTaskEvent(t, events, second.ID, EventTaskCanceled)
	release <- struct{}{}
	waitTaskEvent(t, events, first.ID, EventTaskCompleted)
	select {
	case got := <-started:
		t.Fatalf("canceled task still ran: %q", got)
	case <-time.After(100 * time.Millisecond):
	}
}

func TestTaskManagerPersistsProposalAndEmitsAwaitingConfirmation(t *testing.T) {
	withTempConfig(t)
	page, err := NewChat("claude", "project")
	if err != nil {
		t.Fatal(err)
	}
	events := make(chan TaskEvent, 20)
	manager := NewTaskManager(context.Background(), func(_ context.Context, _ string, req Request) (Reply, error) {
		req.emitStream(StreamEvent{Type: StreamAssistantDelta, Text: "草稿完成\n" + proposalEnvelopeStart + `{"items":[]}` + proposalEnvelopeEnd})
		return Reply{SessionID: "session", Text: "草稿完成", proposals: []ProposalItem{{
			Kind: ProposalKindLore, Operations: []ProposalOperation{{Tool: "storyteller_upsert_lore", Arguments: map[string]any{"project_public_id": "project", "title": "角色 A", "content": "設定"}}},
			Title: "角色 A", Content: "設定",
		}}}, nil
	}, func(event TaskEvent) { events <- event })
	defer manager.Close()

	task, err := manager.Start("claude", Request{ThreadID: page.CurrentID, ProjectID: "project", Prompt: "建立角色設定"})
	if err != nil {
		t.Fatal(err)
	}
	event := waitTaskEvent(t, events, task.ID, EventProposalReady)
	if event.Task.State != TaskAwaitingConfirmation || event.Proposal == nil || event.Proposal.TaskID != task.ID {
		t.Fatalf("unexpected proposal event: %#v", event)
	}
	if event.Task.Partial != "草稿完成\n" {
		t.Fatalf("proposal envelope leaked into task partial: %q", event.Task.Partial)
	}
	stored, err := Proposals("claude", "project", page.CurrentID)
	if err != nil || len(stored) != 1 || stored[0].Status != ProposalAwaitingConfirmation {
		t.Fatalf("proposal was not persisted: %#v, %v", stored, err)
	}
}

func TestTaskManagerAppliesApprovedProposalOnSameThread(t *testing.T) {
	withTempConfig(t)
	page, err := NewChat("claude", "project")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := SaveTurn("claude", "project", page.CurrentID, "seed", "seed", "same-session"); err != nil {
		t.Fatal(err)
	}
	taskID, _ := newThreadID()
	proposal, err := SaveProposal("claude", "project", page.CurrentID, taskID, "", []ProposalItem{{
		Kind: ProposalKindLore, Title: "角色 A", Content: "新設定",
		Operations: []ProposalOperation{{Tool: "storyteller_upsert_lore", Arguments: map[string]any{"project_public_id": "project", "title": "角色 A", "content": "新設定"}}},
	}})
	if err != nil {
		t.Fatal(err)
	}
	proposal, err = DecideProposal("claude", "project", page.CurrentID, proposal.ID, ProposalDecisionApprove)
	if err != nil {
		t.Fatal(err)
	}
	events := make(chan TaskEvent, 20)
	seen := make(chan Request, 1)
	manager := NewTaskManager(context.Background(), func(_ context.Context, _ string, req Request) (Reply, error) {
		seen <- req
		req.emitStream(StreamEvent{Type: StreamToolCompleted, ToolName: "SteamLoom.storyteller_upsert_lore"})
		return Reply{SessionID: req.SessionID, Text: "角色設定已寫入。", applyResult: &ApplyResult{ProposalID: proposal.ID, ContentHash: proposal.ContentHash, Status: "completed"}}, nil
	}, func(event TaskEvent) { events <- event })
	defer manager.Close()
	applyTask, err := manager.Apply(proposal)
	if err != nil {
		t.Fatal(err)
	}
	event := waitTaskEvent(t, events, applyTask.ID, EventApplyCompleted)
	if event.Task.State != TaskApplied || event.Proposal == nil || event.Proposal.Status != ProposalApplied {
		t.Fatalf("unexpected apply completion: %#v", event)
	}
	req := <-seen
	if req.ThreadID != page.CurrentID || req.SessionID != "same-session" || req.grant == nil || len(req.grant.Tools) != 1 {
		t.Fatalf("apply did not resume scoped thread: %#v", req)
	}
	stored, err := Proposals("claude", "project", page.CurrentID)
	if err != nil || len(stored) != 1 || stored[0].Status != ProposalApplied {
		t.Fatalf("applied proposal did not persist: %#v, %v", stored, err)
	}
	chat, err := OpenChat("claude", "project")
	if err != nil {
		t.Fatal(err)
	}
	if got := chat.Messages[len(chat.Messages)-1].Type; got != EventApplyCompleted {
		t.Fatalf("apply result was not persisted in conversation: %s", got)
	}
}

func TestTaskManagerPersistsApplyConflictWithoutRetry(t *testing.T) {
	withTempConfig(t)
	page, err := NewChat("codex", "project")
	if err != nil {
		t.Fatal(err)
	}
	taskID, _ := newThreadID()
	proposal, err := SaveProposal("codex", "project", page.CurrentID, taskID, "", []ProposalItem{{
		Kind: ProposalKindLore, TargetID: "lore-1", BaseVersionID: "41", Title: "角色 A", Content: "新設定", Base: &ProposalSnapshot{Title: "角色 A", Content: "舊設定"},
		Operations: []ProposalOperation{{Tool: "storyteller_upsert_lore", Arguments: map[string]any{
			"project_public_id": "project", "lore_public_id": "lore-1", "base_version_id": 41, "title": "角色 A", "content": "新設定",
		}}},
	}})
	if err != nil {
		t.Fatal(err)
	}
	proposal, err = DecideProposal("codex", "project", page.CurrentID, proposal.ID, ProposalDecisionApprove)
	if err != nil {
		t.Fatal(err)
	}
	events := make(chan TaskEvent, 20)
	manager := NewTaskManager(context.Background(), func(_ context.Context, _ string, req Request) (Reply, error) {
		return Reply{Text: "內容已有新版本，未覆寫。", applyResult: &ApplyResult{
			ProposalID: proposal.ID, ContentHash: proposal.ContentHash, Status: "conflict", Error: "latest version is 42",
		}}, nil
	}, func(event TaskEvent) { events <- event })
	defer manager.Close()
	applyTask, err := manager.Apply(proposal)
	if err != nil {
		t.Fatal(err)
	}
	event := waitTaskEvent(t, events, applyTask.ID, EventApplyConflict)
	if event.Task.State != TaskConflict || event.Proposal == nil || event.Proposal.Status != ProposalConflict {
		t.Fatalf("unexpected conflict outcome: %#v", event)
	}
	stored, err := Proposals("codex", "project", page.CurrentID)
	if err != nil || len(stored) != 1 || stored[0].Status != ProposalConflict {
		t.Fatalf("conflict did not persist: %#v, %v", stored, err)
	}
	chat, err := OpenChat("codex", "project")
	if err != nil {
		t.Fatal(err)
	}
	if got := chat.Messages[len(chat.Messages)-1].Type; got != EventApplyConflict {
		t.Fatalf("conflict event missing from conversation: %s", got)
	}
}

func TestTaskManagerRequiresScopedAssetUploadBetweenPresignAndConfirm(t *testing.T) {
	withTempConfig(t)
	page, err := NewChat("grok", "project")
	if err != nil {
		t.Fatal(err)
	}
	assetRoot := t.TempDir()
	path := filepath.Join(assetRoot, "image.png")
	if err := os.WriteFile(path, []byte("image"), 0o600); err != nil {
		t.Fatal(err)
	}
	originalTaskID, _ := newThreadID()
	proposal, err := SaveProposal("grok", "project", page.CurrentID, originalTaskID, assetRoot, []ProposalItem{{
		Kind: ProposalKindAsset, LocalPath: path, MIMEType: "image/png",
		Operations: []ProposalOperation{
			{Tool: "storyteller_presign_asset_upload", Arguments: map[string]any{"project_public_id": "project"}},
			{Tool: "storyteller_confirm_asset_upload", Arguments: map[string]any{"project_public_id": "project"}},
		},
	}})
	if err != nil {
		t.Fatal(err)
	}
	proposal, err = DecideProposal("grok", "project", page.CurrentID, proposal.ID, ProposalDecisionApprove)
	if err != nil {
		t.Fatal(err)
	}
	events := make(chan TaskEvent, 20)
	manager := NewTaskManager(context.Background(), func(_ context.Context, _ string, req Request) (Reply, error) {
		for _, tool := range []string{"SteamLoom.storyteller_presign_asset_upload", assetMCPServerName + "." + assetMCPToolName, "SteamLoom.storyteller_confirm_asset_upload"} {
			req.emitStream(StreamEvent{Type: StreamToolCompleted, ToolName: tool})
		}
		return Reply{Text: "圖片已上傳。", applyResult: &ApplyResult{ProposalID: proposal.ID, ContentHash: proposal.ContentHash, Status: "completed"}}, nil
	}, func(event TaskEvent) { events <- event })
	defer manager.Close()
	applyTask, err := manager.Apply(proposal)
	if err != nil {
		t.Fatal(err)
	}
	event := waitTaskEvent(t, events, applyTask.ID, EventApplyCompleted)
	if event.Proposal == nil || event.Proposal.Status != ProposalApplied {
		t.Fatalf("asset apply did not complete: %#v", event)
	}
}

func waitTaskEvent(t *testing.T, events <-chan TaskEvent, taskID, eventType string) TaskEvent {
	t.Helper()
	timer := time.NewTimer(2 * time.Second)
	defer timer.Stop()
	for {
		select {
		case event := <-events:
			if event.Task.ID == taskID && event.Type == eventType {
				return event
			}
		case <-timer.C:
			t.Fatal(fmt.Sprintf("timed out waiting for %s", eventType))
		}
	}
}

func waitTaskEvents(t *testing.T, events <-chan TaskEvent, eventType string, taskIDs ...string) {
	t.Helper()
	waiting := make(map[string]bool, len(taskIDs))
	for _, id := range taskIDs {
		waiting[id] = true
	}
	timer := time.NewTimer(2 * time.Second)
	defer timer.Stop()
	for len(waiting) > 0 {
		select {
		case event := <-events:
			if event.Type == eventType {
				delete(waiting, event.Task.ID)
			}
		case <-timer.C:
			t.Fatalf("timed out waiting for %s: %#v", eventType, waiting)
		}
	}
}
