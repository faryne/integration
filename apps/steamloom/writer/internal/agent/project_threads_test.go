package agent

import "testing"

func TestProjectThreadsKeepsLaterQueuedTaskVisible(t *testing.T) {
	withTempConfig(t)
	page, err := NewChat("codex", "project")
	if err != nil {
		t.Fatal(err)
	}
	req := Request{ThreadID: page.CurrentID, ProjectID: "project", Prompt: "first"}
	if _, err := prepareTask("codex", req, "task-one"); err != nil {
		t.Fatal(err)
	}
	if err := recordTaskStarted("codex", "project", page.CurrentID, "task-one"); err != nil {
		t.Fatal(err)
	}
	req.Prompt = "second"
	if _, err := prepareTask("codex", req, "task-two"); err != nil {
		t.Fatal(err)
	}
	if err := recordTaskCompleted("codex", "project", page.CurrentID, "task-one", Reply{Text: "done", SessionID: "session-one"}, 1); err != nil {
		t.Fatal(err)
	}

	threads, err := ProjectThreads("project")
	if err != nil {
		t.Fatal(err)
	}
	if len(threads) != 1 || threads[0].LastTaskState != TaskQueued || threads[0].ActiveTaskID != "task-two" {
		t.Fatalf("later queued task was hidden by earlier completion: %#v", threads)
	}
}

// 舊版若漏寫 terminal event，較舊的 running task 不得蓋掉後續已完成工作的狀態。
func TestProjectThreadsIgnoresStaleRunningTaskBeforeNewerCompletion(t *testing.T) {
	withTempConfig(t)
	page, err := NewChat("claude", "project")
	if err != nil {
		t.Fatal(err)
	}
	req := Request{ThreadID: page.CurrentID, ProjectID: "project", Prompt: "stale"}
	if _, err := prepareTask("claude", req, "stale-task"); err != nil {
		t.Fatal(err)
	}
	if err := recordTaskStarted("claude", "project", page.CurrentID, "stale-task"); err != nil {
		t.Fatal(err)
	}
	req.Prompt = "newer"
	if _, err := prepareTask("claude", req, "newer-task"); err != nil {
		t.Fatal(err)
	}
	if err := recordTaskStarted("claude", "project", page.CurrentID, "newer-task"); err != nil {
		t.Fatal(err)
	}
	if err := recordTaskCompleted("claude", "project", page.CurrentID, "newer-task", Reply{Text: "done", SessionID: "session"}, 1); err != nil {
		t.Fatal(err)
	}

	threads, err := ProjectThreads("project")
	if err != nil {
		t.Fatal(err)
	}
	if len(threads) != 1 || threads[0].LastTaskState != TaskCompleted || threads[0].ActiveTaskID != "newer-task" {
		t.Fatalf("stale running task hid newer completion: %#v", threads)
	}
}
