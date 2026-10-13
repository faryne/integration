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
	if err := recordTaskCompleted("codex", "project", page.CurrentID, "task-one", Reply{Text: "done", SessionID: "session-one"}); err != nil {
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
