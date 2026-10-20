package agent

import (
	"context"
	"errors"
	"fmt"
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
	if _, err := ConfigureMediaProposal("codex", "project", page.CurrentID, proposal.ID, "worker-2", map[string]any{"mode": "pro"}, 2); err != nil {
		t.Fatal(err)
	}
	proposal, err = ProposalByID("codex", "project", page.CurrentID, proposal.ID)
	if err != nil || proposal.Items[0].WorkerID != "worker-2" || proposal.Items[0].RecommendedWorkerID != "worker-1" {
		t.Fatalf("worker selection was not persisted: %#v, err = %v", proposal.Items[0], err)
	}
	if proposal, err = DecideProposal("codex", "project", page.CurrentID, proposal.ID, ProposalDecisionApprove); err != nil {
		t.Fatal(err)
	}
	chat, err := OpenChat("codex", "project")
	if err != nil {
		t.Fatal(err)
	}
	if got := chat.Messages[len(chat.Messages)-1].Text; got != "已核准執行：媒體生成〈角色圖〉，執行 2 次" {
		t.Fatalf("approval text = %q", got)
	}
	events := make(chan TaskEvent, 50)
	release := make(chan error)
	manager := NewTaskManager(context.Background(), func(context.Context, string, Request) (Reply, error) {
		return Reply{Text: "done"}, nil
	}, func(event TaskEvent) { events <- event })
	manager.SetProposalApplyRunner(func(ctx context.Context, _ Proposal, item ProposalItem) (string, error) {
		for run := 1; run <= item.ExecutionCount; run++ {
			if err := ReportApplyItemProgress(ctx, EventApplyItemStarted, fmt.Sprintf("第 %d/%d 開始", run, item.ExecutionCount)); err != nil {
				return "", err
			}
			if item.JobInputs["mode"] == "pro" && item.ExecutionCount == 2 {
				return "", <-release
			}
			if err := ReportApplyItemProgress(ctx, EventApplyItemDone, fmt.Sprintf("第 %d/%d 完成", run, item.ExecutionCount)); err != nil {
				return "", err
			}
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

	retried, err := RetryMediaProposal("codex", "project", page.CurrentID, proposal.ID, "worker-1", map[string]any{"mode": "standard"}, 3)
	if err != nil {
		t.Fatal(err)
	}
	retryTask, err := manager.Apply(retried)
	if err != nil {
		t.Fatal(err)
	}
	waitTaskEvent(t, events, retryTask.ID, EventApplyCompleted)
	applied, err := ProposalByID("codex", "project", page.CurrentID, proposal.ID)
	if err != nil || applied.Status != ProposalApplied || applied.Items[0].JobInputs["mode"] != "standard" || applied.Items[0].ExecutionCount != 3 {
		t.Fatalf("retried proposal = %#v, err = %v", applied, err)
	}
	if _, err := RetryMediaProposal("codex", "project", page.CurrentID, proposal.ID, "worker-1", nil, 1); err == nil {
		t.Fatal("applied media proposal must not be retried")
	}
	chat, err = OpenChat("codex", "project")
	if err != nil {
		t.Fatal(err)
	}
	progress := []string{}
	for _, line := range chat.Messages {
		if line.TaskID == retryTask.ID && (line.Type == EventApplyItemStarted || line.Type == EventApplyItemDone) {
			progress = append(progress, line.Text)
		}
	}
	want := []string{
		"生成媒體「角色圖」……第 1/3 開始", "生成媒體「角色圖」……第 1/3 完成",
		"生成媒體「角色圖」……第 2/3 開始", "生成媒體「角色圖」……第 2/3 完成",
		"生成媒體「角色圖」……第 3/3 開始", "生成媒體「角色圖」……第 3/3 完成",
	}
	if fmt.Sprint(progress) != fmt.Sprint(want) {
		t.Fatalf("media progress = %#v, want %#v", progress, want)
	}
}
