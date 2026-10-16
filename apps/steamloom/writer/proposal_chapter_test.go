package main

import (
	"testing"
)

func TestProposalChapterMutation(t *testing.T) {
	content := "# ⟦one⟧第一章⟦/one⟧\n舊內容\n\n# ⟦two⟧第二章⟦/two⟧\n保留內容"
	chapter, err := proposalChapterContent(content, "one")
	if err != nil || chapter != "# ⟦one⟧第一章⟦/one⟧\n舊內容\n" {
		t.Fatalf("chapter content = %q, %v", chapter, err)
	}
	replaced, err := replaceProposalChapter(content, "one", "# ⟦one⟧第一章⟦/one⟧\n新內容\n")
	if err != nil || replaced != "# ⟦one⟧第一章⟦/one⟧\n新內容\n\n# ⟦two⟧第二章⟦/two⟧\n保留內容" {
		t.Fatalf("replace = %q, %v", replaced, err)
	}
	appended, err := appendProposalChapter(content, "one", "# ⟦new⟧追逐⟦/new⟧\n新增內容\n")
	if err != nil || appended != "# ⟦one⟧第一章⟦/one⟧\n舊內容\n\n# ⟦new⟧追逐⟦/new⟧\n新增內容\n\n# ⟦two⟧第二章⟦/two⟧\n保留內容" {
		t.Fatalf("append = %q, %v", appended, err)
	}
}

func TestProposalChapterIgnoresCodeFence(t *testing.T) {
	content := "```md\n# ⟦fake⟧不是章節⟦/fake⟧\n```\n# ⟦real⟧真的章節⟦/real⟧\n內容"
	if _, err := proposalChapterContent(content, "fake"); err == nil {
		t.Fatal("code fence heading was accepted")
	}
	if chapter, err := proposalChapterContent(content, "real"); err != nil || chapter == "" {
		t.Fatalf("real chapter = %q, %v", chapter, err)
	}
}
