package agent

import (
	"context"
	"errors"
	"strings"
	"testing"
)

func validLoreProposal() []ProposalItem {
	return []ProposalItem{{
		Kind: ProposalKindLore, Title: "角色 A", Content: "設定",
		Operations: []ProposalOperation{{Tool: "storyteller_upsert_lore", Arguments: map[string]any{"project_public_id": "project", "title": "角色 A", "content": "設定"}}},
	}}
}

func TestTaskManagerRepairsInvalidProposalOnSameSession(t *testing.T) {
	withTempConfig(t)
	page, err := NewChat("claude", "project")
	if err != nil {
		t.Fatal(err)
	}
	calls := []Request{}
	events := make(chan TaskEvent, 40)
	manager := NewTaskManager(context.Background(), func(_ context.Context, _ string, req Request) (Reply, error) {
		calls = append(calls, req)
		if len(calls) == 1 {
			raw := "第一版摘要\n" + proposalEnvelopeStart + "\n{壞掉的 JSON"
			return Reply{SessionID: "session-1", raw: raw}, &ProposalError{Err: errors.New("缺少結束標記"), Visible: "第一版摘要", Raw: raw, SessionID: "session-1"}
		}
		return Reply{SessionID: "session-1", Text: "已修正格式", proposals: validLoreProposal()}, nil
	}, func(event TaskEvent) { events <- event })
	defer manager.Close()

	task, err := manager.Start("claude", Request{ThreadID: page.CurrentID, ProjectID: "project", Prompt: "建立角色設定"})
	if err != nil {
		t.Fatal(err)
	}
	waitTaskEvent(t, events, task.ID, EventProposalReady)
	if len(calls) != 2 || calls[1].SessionID != "session-1" || !strings.Contains(calls[1].Prompt, "缺少結束標記") {
		t.Fatalf("repair turn did not resume the same session: %#v", calls)
	}
	chat, err := OpenChat("claude", "project")
	if err != nil {
		t.Fatal(err)
	}
	var invalid ChatLine
	for _, line := range chat.Messages {
		if line.Type == EventProposalInvalid {
			invalid = line
		}
	}
	raw, err := ProposalInvalidOutput("claude", "project", page.CurrentID, invalid.EventID)
	if err != nil || !strings.Contains(raw, "{壞掉的 JSON") {
		t.Fatalf("raw output was not kept: %q, %v", raw, err)
	}
}

func TestTaskManagerStopsAfterOneFailedRepair(t *testing.T) {
	withTempConfig(t)
	page, err := NewChat("claude", "project")
	if err != nil {
		t.Fatal(err)
	}
	calls := 0
	events := make(chan TaskEvent, 40)
	manager := NewTaskManager(context.Background(), func(_ context.Context, _ string, req Request) (Reply, error) {
		calls++
		return Reply{SessionID: "session-1"}, &ProposalError{Err: errors.New("JSON 不正確"), Raw: "raw", SessionID: "session-1"}
	}, func(event TaskEvent) { events <- event })
	defer manager.Close()

	task, err := manager.Start("claude", Request{ThreadID: page.CurrentID, ProjectID: "project", Prompt: "建立角色設定"})
	if err != nil {
		t.Fatal(err)
	}
	waitTaskEvent(t, events, task.ID, EventTaskFailed)
	chat, err := OpenChat("claude", "project")
	if err != nil {
		t.Fatal(err)
	}
	invalid := 0
	for _, line := range chat.Messages {
		if line.Type == EventProposalInvalid {
			invalid++
		}
	}
	if calls != 2 || invalid != 2 || chat.SessionID != "session-1" {
		t.Fatalf("expected exactly one repair: calls=%d invalid=%d session=%q", calls, invalid, chat.SessionID)
	}
}

func TestAskKeepsRawOutputWhenEnvelopeIsBroken(t *testing.T) {
	_, items, err := parseProposalEnvelope("摘要\n" + proposalEnvelopeStart + "\n{}")
	if err == nil || items != nil {
		t.Fatalf("broken envelope must fail: %v", err)
	}
	if got := proposalVisibleText("摘要\n" + proposalEnvelopeStart + "\n{}"); got != "摘要" {
		t.Fatalf("visible text = %q", got)
	}
}
