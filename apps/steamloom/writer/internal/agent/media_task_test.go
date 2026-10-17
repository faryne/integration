package agent

import (
	"context"
	"errors"
	"testing"
)

// 媒體生成在背景佇列執行：Worker 還在跑時，同一 thread 的對話 task 要能照常完成；失敗後可換參數重跑。
func TestMediaBriefRunsInBackgroundAndCanRetry(t *testing.T) {
	withTempConfig(t)
	page, err := NewChat("codex", "project")
	if err != nil {
		t.Fatal(err)
	}
	taskID, _ := newThreadID()
	proposal, err := SaveProposal("codex", "project", page.CurrentID, taskID, "", []ProposalItem{{
		ProposalType: ProposalTypeMediaBrief, WorkerID: "worker-1", Title: "角色圖", Brief: &MediaBrief{Prompt: "藍髮少女"},
	}})
	if err != nil {
		t.Fatal(err)
	}
	if _, err := ConfigureMediaProposal("codex", "project", page.CurrentID, proposal.ID, "worker-2", map[string]any{"mode": "pro"}); err != nil {
		t.Fatal(err)
	}
	proposal, err = ProposalByID("codex", "project", page.CurrentID, proposal.ID)
	if err != nil || proposal.Items[0].WorkerID != "worker-2" || proposal.Items[0].RecommendedWorkerID != "worker-1" {
		t.Fatalf("worker selection was not persisted: %#v, err = %v", proposal.Items[0], err)
	}
	if proposal, err = DecideProposal("codex", "project", page.CurrentID, proposal.ID, ProposalDecisionApprove); err != nil {
		t.Fatal(err)
	}
	events := make(chan TaskEvent, 50)
	release := make(chan error)
	manager := NewTaskManager(context.Background(), func(context.Context, string, Request) (Reply, error) {
		return Reply{Text: "done"}, nil
	}, func(event TaskEvent) { events <- event })
	manager.SetProposalApplyRunner(func(_ context.Context, _ Proposal, item ProposalItem) (string, error) {
		if item.JobInputs["mode"] == "pro" {
			return "", <-release
		}
		return "", nil
	})
	defer manager.Close()

	mediaTask, err := manager.Apply(proposal)
	if err != nil || !mediaTask.Background {
		t.Fatalf("media task = %#v, err = %v", mediaTask, err)
	}
	waitTaskEvent(t, events, mediaTask.ID, EventApplyStarted)
	chatTask, err := manager.Start("codex", Request{ThreadID: page.CurrentID, ProjectID: "project", Prompt: "繼續寫第二章"})
	if err != nil {
		t.Fatal(err)
	}
	waitTaskEvent(t, events, chatTask.ID, EventTaskCompleted)

	release <- errors.New("PixAI 回傳 HTTP 400：mode not supported")
	waitTaskEvent(t, events, mediaTask.ID, EventApplyFailed)
	failed, err := ProposalByID("codex", "project", page.CurrentID, proposal.ID)
	if err != nil || failed.Status != ProposalApplyFailed {
		t.Fatalf("failed proposal = %#v, err = %v", failed, err)
	}

	retried, err := RetryMediaProposal("codex", "project", page.CurrentID, proposal.ID, "worker-1", map[string]any{"mode": "standard"})
	if err != nil {
		t.Fatal(err)
	}
	retryTask, err := manager.Apply(retried)
	if err != nil {
		t.Fatal(err)
	}
	waitTaskEvent(t, events, retryTask.ID, EventApplyCompleted)
	applied, err := ProposalByID("codex", "project", page.CurrentID, proposal.ID)
	if err != nil || applied.Status != ProposalApplied || applied.Items[0].JobInputs["mode"] != "standard" {
		t.Fatalf("retried proposal = %#v, err = %v", applied, err)
	}
	if _, err := RetryMediaProposal("codex", "project", page.CurrentID, proposal.ID, "worker-1", nil); err == nil {
		t.Fatal("applied media proposal must not be retried")
	}
}
