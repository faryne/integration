package storyteller

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// warningCodes 只取 code，方便比對「出現了哪些問題」而不綁死訊息文字。
func warningCodes(report storyFormatReport) []string {
	codes := []string{}
	for _, w := range report.Warnings {
		codes = append(codes, w.Code)
	}
	return codes
}

func TestCheckStoryContentFormatCleanContent(t *testing.T) {
	content := "# ⟦h1⟧第一幕⟦/h1⟧\n⟦b1⟧⟦/b1⟧\n⟦p1⟧*2026-06-01*　**DEBUT MV** ⟦footnote-f1 note=\"註\"⟧資料夾⟦/footnote-f1⟧⟦/p1⟧\n" +
		"⟦table tableId=\"t1\" rowId=\"r1\"⟧| A | B |⟦/table⟧\n⟦table tableId=\"t1\" rowId=\"r2\"⟧| 1 | 2 |⟦/table⟧\n" +
		"```go id=\"c1\"\nfmt.Println(\"⟦not-a-marker⟧ ~~x~~\")\n```"

	report := checkStoryContentFormat(content)

	require.True(t, report.OK)
	require.Empty(t, report.Warnings)
	require.Equal(t, []storyFormatChapter{{Level: 1, Title: "第一幕", MarkerID: "h1"}}, report.Chapters)
	require.Equal(t, 4, report.Summary.Paragraphs) // 標題、內文、code block 各一，空白段落不算；表格列不算段落
}

// 2026-10-04〈製作我〉第八章的真實情境：前綴包在 marker 裡，存檔時會自動修，所以不計入 OK，
// 但要回報，章節也要以修好後的樣子列出來。
func TestCheckStoryContentFormatBlockPrefixInsideMarker(t *testing.T) {
	report := checkStoryContentFormat("⟦8a8b000000000001⟧# 第一幕⟦/8a8b000000000001⟧\n⟦p1⟧內文⟦/p1⟧")

	require.True(t, report.OK)
	require.Equal(t, []string{"block_prefix_inside_marker"}, warningCodes(report))
	require.True(t, report.Warnings[0].AutoFixedOnSave)
	require.Equal(t, "# ⟦8a8b000000000001⟧第一幕⟦/8a8b000000000001⟧", report.Warnings[0].Suggestion)
	require.Equal(t, 1, report.Summary.Chapters)
}

func TestCheckStoryContentFormatDetectsErrors(t *testing.T) {
	cases := []struct {
		name, content, code string
	}{
		{"結尾缺 marker", "⟦p1⟧沒有結尾", "unpaired_paragraph_marker"},
		{"前後 id 不一致", "⟦p1⟧內文⟦/p2⟧", "unpaired_paragraph_marker"},
		{"開頭缺 marker", "內文⟦/p1⟧", "unpaired_paragraph_marker"},
		{"段落 id 重複", "⟦p1⟧一⟦/p1⟧\n⟦p1⟧二⟦/p1⟧", "duplicate_marker_id"},
		{"註解沒關", "⟦p1⟧⟦comment-c1 comment=\"改短\"⟧這段⟦/p1⟧", "unbalanced_inline_marker"},
		{"腳注只有結尾", "⟦p1⟧這段⟦/footnote-f1⟧⟦/p1⟧", "unbalanced_inline_marker"},
		{"code block 沒關", "```go\nfmt.Println()", "unclosed_code_fence"},
		{"表格列不相鄰", "⟦table tableId=\"t1\" rowId=\"r1\"⟧| A |⟦/table⟧\n⟦p1⟧中間⟦/p1⟧\n⟦table tableId=\"t1\" rowId=\"r2\"⟧| B |⟦/table⟧", "table_rows_not_adjacent"},
		{"GFM 刪除線", "⟦p1⟧這是~~錯的~~刪除線⟦/p1⟧", "gfm_strikethrough"},
	}
	for _, c := range cases {
		report := checkStoryContentFormat(c.content)
		require.False(t, report.OK, c.name)
		require.Contains(t, warningCodes(report), c.code, c.name)
	}
}

// 啟發式檢查只是提示，不讓 OK 變成 false
func TestCheckStoryContentFormatUnbalancedStyleIsInfo(t *testing.T) {
	report := checkStoryContentFormat("⟦p1⟧**粗體沒關⟦/p1⟧")

	require.True(t, report.OK)
	require.Equal(t, []string{"unbalanced_inline_style"}, warningCodes(report))
	require.Equal(t, storyFormatSeverityInfo, report.Warnings[0].Severity)
}

// 沒有 marker 的新段落是合法的（存檔時 backfill 會補 id），不能被當成錯誤
func TestCheckStoryContentFormatAcceptsParagraphsWithoutMarker(t *testing.T) {
	report := checkStoryContentFormat("# 新的一章\n\n她推開門。\n> 引用")

	require.True(t, report.OK)
	require.Empty(t, report.Warnings)
	require.Equal(t, 1, report.Summary.Chapters)
}

func TestRemovedStoryMarkerIDsIgnoresBlankParagraphs(t *testing.T) {
	previous := "# ⟦h1⟧標題⟦/h1⟧\n⟦b1⟧⟦/b1⟧\n⟦p1⟧一⟦/p1⟧\n⟦p2⟧二⟦/p2⟧\n```go id=\"c1\"\nx\n```"
	next := "# ⟦h1⟧標題⟦/h1⟧\n⟦p2⟧二（改過）⟦/p2⟧"

	require.Equal(t, []string{"p1", "c1"}, removedStoryMarkerIDs(previous, next))
}

func TestStoryFormatWarningsAfterSaveIsNeverNil(t *testing.T) {
	warnings := storyFormatWarningsAfterSave("⟦p1⟧沒問題⟦/p1⟧")

	require.NotNil(t, warnings)
	require.Empty(t, *warnings)
}
