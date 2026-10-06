package storyteller

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func chapterBatchFixture() string {
	return stringsJoinLines(
		"⟦p-0⟧前言⟦/p-0⟧",
		"# ⟦c1⟧第一章⟦/c1⟧",
		"⟦p-1⟧一⟦/p-1⟧",
		"# ⟦c2⟧第二章⟦/c2⟧",
		"⟦p-2⟧二⟦/p-2⟧",
		"# ⟦c3⟧第三章⟦/c3⟧",
		"⟦p-3⟧三⟦/p-3⟧",
	)
}

// 多章一次替換：傳入順序不必照文件順序，行數變動也不會讓其他章位置跑掉；回傳的起始行要對得上存檔後的內容。
func TestReplaceStoryChaptersContentAppliesBottomUp(t *testing.T) {
	content, starts, err := replaceStoryChaptersContent(chapterBatchFixture(), []storytellerChapterReplacementArguments{
		{MarkerID: "c3", Content: "# ⟦c3⟧第三章改⟦/c3⟧\n三改"},
		{MarkerID: "c1", Content: "# ⟦c1⟧第一章改⟦/c1⟧\n一之一\n一之二\n一之三"},
	})
	require.NoError(t, err)
	require.Equal(t, stringsJoinLines(
		"⟦p-0⟧前言⟦/p-0⟧",
		"# ⟦c1⟧第一章改⟦/c1⟧",
		"一之一",
		"一之二",
		"一之三",
		"# ⟦c2⟧第二章⟦/c2⟧",
		"⟦p-2⟧二⟦/p-2⟧",
		"# ⟦c3⟧第三章改⟦/c3⟧",
		"三改",
	), content)
	require.Equal(t, []int{7, 1}, starts)

	summaries, err := storytellerChapterSummariesAtLines(content, starts)
	require.NoError(t, err)
	require.Equal(t, "第三章改", summaries[0].Title)
	require.Equal(t, 2, summaries[0].Order)
	require.Equal(t, "第一章改", summaries[1].Title)
}

// 任何一章有問題就整批拒絕，錯誤帶 chapters[i]。
func TestReplaceStoryChaptersContentRejectsWholeBatch(t *testing.T) {
	cases := map[string][]storytellerChapterReplacementArguments{
		"must include a heading line": {{MarkerID: "c1", Content: "# ⟦c1⟧ok⟦/c1⟧"}, {MarkerID: "c2", Content: "沒有標題"}},
		"duplicate marker_id":         {{MarkerID: "c1", Content: "# a"}, {MarkerID: "c1", Content: "# b"}},
		"chapters[1]":                 {{MarkerID: "c1", Content: "# a"}, {MarkerID: "nope", Content: "# b"}},
		"1 to 20 items":               nil,
	}
	for want, chapters := range cases {
		_, _, err := replaceStoryChaptersContent(chapterBatchFixture(), chapters)
		require.ErrorContains(t, err, want)
	}
}
