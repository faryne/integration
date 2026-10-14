package agent

import (
	"os"
	"path/filepath"
	"testing"
)

func TestRenameChatPersistsTitleWithoutChangingActivityTime(t *testing.T) {
	withTempConfig(t)
	page, err := NewChat("claude", "project")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := SaveTurn("claude", "project", page.CurrentID, "原始標題", nil, "answer", "session"); err != nil {
		t.Fatal(err)
	}
	before, err := OpenChat("claude", "project")
	if err != nil {
		t.Fatal(err)
	}
	renamed, err := RenameChat("claude", "project", page.CurrentID, "  新的任務標題  ")
	if err != nil {
		t.Fatal(err)
	}
	if renamed.Threads[0].Title != "新的任務標題" || renamed.Threads[0].UpdatedAt != before.Threads[0].UpdatedAt || renamed.SessionID != "session" || len(renamed.Messages) != 2 {
		t.Fatalf("unexpected renamed chat: %#v", renamed)
	}
	if _, err := RenameChat("claude", "project", page.CurrentID, "   "); err == nil {
		t.Fatal("blank title was accepted")
	}
}

func withTempConfig(t *testing.T) string {
	t.Helper()
	root := t.TempDir()
	previous := userConfigDir
	userConfigDir = func() (string, error) { return root, nil }
	t.Cleanup(func() { userConfigDir = previous })
	return root
}

func TestLegacyChatLineBecomesTypedEvent(t *testing.T) {
	root := withTempConfig(t)
	dir := filepath.Join(root, "SteamLoom Writer", "chats", "claude", "project")
	if err := os.MkdirAll(dir, 0o700); err != nil {
		t.Fatal(err)
	}
	const threadID = "0123456789abcdef"
	if err := os.WriteFile(filepath.Join(dir, threadID+".jsonl"), []byte("{\"role\":\"user\",\"text\":\"舊訊息\"}\n"), 0o600); err != nil {
		t.Fatal(err)
	}
	if err := saveIndex(dir, chatIndex{CurrentID: threadID, Threads: []Thread{{ID: threadID}}}); err != nil {
		t.Fatal(err)
	}

	page, err := OpenChat("claude", "project")
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Messages) != 1 || page.Messages[0].Type != EventMessageUser || page.Messages[0].Text != "舊訊息" {
		t.Fatalf("unexpected messages: %#v", page.Messages)
	}
}

func TestSaveTurnPersistsMessageIDsAndReferences(t *testing.T) {
	withTempConfig(t)
	page, err := NewChat("claude", "project")
	if err != nil {
		t.Fatal(err)
	}
	references := []PromptReference{{Type: "chat_message", ID: "quote-1", Title: "Agent 回覆", Text: "原始回答", Role: "assistant"}}
	if _, err := SaveTurn("claude", "project", page.CurrentID, "接著說", references, "新的回答", "session"); err != nil {
		t.Fatal(err)
	}
	page, err = OpenChat("claude", "project")
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Messages) != 2 || page.Messages[0].EventID == "" || page.Messages[1].EventID == "" || len(page.Messages[0].References) != 1 || page.Messages[0].References[0].Text != "原始回答" {
		t.Fatalf("unexpected saved references: %#v", page.Messages)
	}
}

func TestDeleteChatRemovesFileAndSelectsNextThread(t *testing.T) {
	root := withTempConfig(t)
	first, err := NewChat("codex", "project")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := SaveTurn("codex", "project", first.CurrentID, "第一題", nil, "第一答", "session-one"); err != nil {
		t.Fatal(err)
	}
	second, err := NewChat("codex", "project")
	if err != nil {
		t.Fatal(err)
	}
	if _, err := SaveTurn("codex", "project", second.CurrentID, "第二題", nil, "第二答", "session-two"); err != nil {
		t.Fatal(err)
	}

	page, err := DeleteChat("codex", "project", second.CurrentID)
	if err != nil {
		t.Fatal(err)
	}
	if len(page.Threads) != 1 || page.CurrentID != first.CurrentID {
		t.Fatalf("unexpected page after delete: %#v", page)
	}
	deleted := filepath.Join(root, "SteamLoom Writer", "chats", "codex", "project", second.CurrentID+".jsonl")
	if _, err := os.Stat(deleted); !os.IsNotExist(err) {
		t.Fatalf("deleted thread still exists: %v", err)
	}
}

func TestDeleteLastEmptyChatReturnsBlankPage(t *testing.T) {
	withTempConfig(t)
	page, err := NewChat("grok", "project")
	if err != nil {
		t.Fatal(err)
	}
	page, err = DeleteChat("grok", "project", page.CurrentID)
	if err != nil {
		t.Fatal(err)
	}
	if page.CurrentID != "" || len(page.Threads) != 0 || len(page.Messages) != 0 {
		t.Fatalf("expected blank page, got %#v", page)
	}
}
