package storyteller

import "testing"

// 驗證 Phase 0 新增的刪除線 delimiter（--文字--）跟既有的分隔線 blockKind（獨立一行的
// ---）在 wordCount 裡不會互相誤判，對應定案文件 Phase 0 的邊界測試要求。
func TestWordCountHandlesStrikethroughDelimiter(t *testing.T) {
	line := `⟦m1⟧這是--刪除線--文字⟦/m1⟧`
	got := wordCount(line)
	want := uint(len([]rune("這是刪除線文字")))
	if got != want {
		t.Fatalf("wordCount() = %d, want %d", got, want)
	}
}

// 分隔線是獨立一行、行首前綴在段落 marker 外面、內容清空只留前綴（比照前端
// serializeParagraph 的輸出順序：blockKindPrefix 在 marker 之前），跟刪除線走不同解析
// 階段（行首整行前綴 vs 行內逐字掃描 delimiter），不應貢獻任何字數。
func TestWordCountHorizontalRuleLineContributesNoWords(t *testing.T) {
	line := `---⟦m1⟧⟦/m1⟧`
	if got := wordCount(line); got != 0 {
		t.Fatalf("wordCount() = %d, want 0", got)
	}
}

// 混合案例：同一份內容裡分隔線跟刪除線各自一行，字數只計刪除線那行的可見文字。
func TestWordCountMixedHorizontalRuleAndStrikethroughLines(t *testing.T) {
	content := "---⟦m1⟧⟦/m1⟧\n⟦m2⟧--被劃掉--還留著⟦/m2⟧"
	got := wordCount(content)
	want := uint(len([]rune("被劃掉還留著")))
	if got != want {
		t.Fatalf("wordCount() = %d, want %d", got, want)
	}
}
