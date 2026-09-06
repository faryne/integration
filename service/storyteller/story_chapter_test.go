package storyteller

import (
	"encoding/json"
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestStoryChapterSpansSkipsCodeFenceAndTableRows(t *testing.T) {
	content := stringsJoinLines(
		"# ⟦chapter-1⟧第一章⟦/chapter-1⟧",
		"⟦p-1⟧第一段⟦/p-1⟧",
		"```go",
		"# 這不是標題",
		"```",
		"⟦table tableId=\"tbl_1\" rowId=\"row_1\"⟧| # 這也不是標題 |⟦/table⟧",
		"#### ⟦chapter-2⟧第二節⟦/chapter-2⟧",
		"⟦p-2⟧第二段⟦/p-2⟧",
		"## ⟦chapter-3⟧第三章⟦/chapter-3⟧",
		"⟦p-3⟧第三段⟦/p-3⟧",
	)

	spans := storyChapterSpans(content)

	require.Equal(t, []storyChapterSpan{
		{MarkerID: "chapter-1", HeadingLevel: 1, Title: "第一章", StartLine: 0, EndLine: 6},
		{MarkerID: "chapter-2", HeadingLevel: 4, Title: "第二節", StartLine: 6, EndLine: 8},
		{MarkerID: "chapter-3", HeadingLevel: 2, Title: "第三章", StartLine: 8, EndLine: 10},
	}, spans)
}

func TestStoryChapterSummariesIncludeWordCountAndOrder(t *testing.T) {
	summaries := storytellerChapterSummaries(stringsJoinLines(
		"# ⟦chapter-1⟧第一章⟦/chapter-1⟧",
		"⟦p-1⟧甲乙⟦/p-1⟧",
		"## ⟦chapter-2⟧第二章⟦/chapter-2⟧",
		"⟦p-2⟧丙丁戊⟦/p-2⟧",
	))

	require.Len(t, summaries, 2)
	require.Equal(t, "chapter-1", summaries[0].MarkerID)
	require.Equal(t, 0, summaries[0].Order)
	require.Equal(t, uint(5), summaries[0].WordCount)
	require.Equal(t, "chapter-2", summaries[1].MarkerID)
	require.Equal(t, 1, summaries[1].Order)
	require.Equal(t, uint(6), summaries[1].WordCount)
}

func TestStoryChapterWriteOutputAfterSaveUsesRescannedHeading(t *testing.T) {
	content := stringsJoinLines(
		"# ⟦new-marker⟧新標題⟦/new-marker⟧",
		"⟦p-1⟧新內容⟦/p-1⟧",
	)

	output, err := storytellerChapterWriteOutputAfterSave(content, 0, 12, true)

	require.NoError(t, err)
	require.Equal(t, "new-marker", output.MarkerID)
	require.Equal(t, 1, output.HeadingLevel)
	require.Equal(t, "新標題", output.Title)
	require.Equal(t, uint64(12), output.VersionID)
	require.True(t, output.VersionConflict)
}

func TestStoryChapterDetailJSONShape(t *testing.T) {
	detail, err := storytellerChapterDetailByMarker(stringsJoinLines(
		"# ⟦chapter-1⟧第一章⟦/chapter-1⟧",
		"⟦p-1⟧第一段⟦/p-1⟧",
		"## ⟦chapter-2⟧第二章⟦/chapter-2⟧",
	), "chapter-1", 9)
	require.NoError(t, err)

	body, err := json.Marshal(detail)
	require.NoError(t, err)
	require.JSONEq(t, `{"marker_id":"chapter-1","heading_level":1,"title":"第一章","word_count":6,"order":0,"content":"# ⟦chapter-1⟧第一章⟦/chapter-1⟧\n⟦p-1⟧第一段⟦/p-1⟧","version_id":9}`, string(body))
}

func stringsJoinLines(lines ...string) string {
	return strings.Join(lines, "\n")
}
