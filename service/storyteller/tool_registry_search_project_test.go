package storyteller

import (
	"strings"
	"testing"

	"github.com/stretchr/testify/require"
)

func newTestProjectSearcher(t *testing.T, search string, isRegex bool, contextChars, maxHits int) *storytellerProjectSearcher {
	pattern, _, err := compileStorytellerSearchReplace(search, "", isRegex)
	require.NoError(t, err)
	return &storytellerProjectSearcher{pattern: pattern, contextChars: contextChars, maxHits: maxHits, output: storytellerSearchProjectOutput{Targets: []storytellerSearchTarget{}}}
}

// 文字命中要標出所在章節、行號，前後文以 rune 切，中文不會被切壞。
func TestProjectSearcherTextHitsReportChapterAndLine(t *testing.T) {
	searcher := newTestProjectSearcher(t, "梭梭", false, 3, 10)
	searcher.searchText(storytellerSearchTarget{Type: "story", PublicID: "s1"}, stringsJoinLines(
		"前言提到梭梭",
		"# ⟦c1⟧第一章⟦/c1⟧",
		"今天梭梭來了",
	))

	out := searcher.output
	require.Equal(t, 2, out.TotalMatchCount)
	require.False(t, out.Truncated)
	require.Len(t, out.Targets, 1)
	hits := out.Targets[0].Hits
	require.Equal(t, storytellerSearchHit{Line: 1, Before: "言提到", Match: "梭梭", After: "\n# "}, hits[0])
	require.Equal(t, "c1", hits[1].MarkerID)
	require.Equal(t, "第一章", hits[1].ChapterTitle)
	require.Equal(t, 3, hits[1].Line)
	require.Equal(t, "\n今天", hits[1].Before)
	require.Equal(t, "來了", hits[1].After)
}

// 超過 max_hits 時 hits 截斷，但總數與各篇 match_count 照實算；沒命中的篇不列出。
func TestProjectSearcherTruncatesHitsButKeepsCounts(t *testing.T) {
	searcher := newTestProjectSearcher(t, `甲+`, true, 0, 2)
	searcher.searchText(storytellerSearchTarget{PublicID: "a"}, "甲 甲甲 甲")
	searcher.searchText(storytellerSearchTarget{PublicID: "b"}, "乙")
	searcher.searchText(storytellerSearchTarget{PublicID: "c"}, "甲")

	out := searcher.output
	require.True(t, out.Truncated)
	require.Equal(t, 4, out.TotalMatchCount)
	require.Len(t, out.Targets, 2)
	require.Equal(t, 3, out.Targets[0].MatchCount)
	require.Len(t, out.Targets[0].Hits, 2)
	require.Equal(t, 1, out.Targets[1].MatchCount)
	require.Empty(t, out.Targets[1].Hits)
}

// 圖像故事只搜 description，命中給 page_index。
func TestProjectSearcherImageStorySearchesDescriptionsOnly(t *testing.T) {
	searcher := newTestProjectSearcher(t, "page", false, 5, 10)
	searcher.searchImageStory(storytellerSearchTarget{PublicID: "img"}, `{"pages":[{"id":"page-1","key":"page.png","description":"無","sort":0},{"id":"p2","key":"k","description":"第二 page","sort":1}]}`)

	out := searcher.output
	require.Equal(t, 1, out.TotalMatchCount)
	require.Equal(t, 1, *out.Targets[0].Hits[0].PageIndex)
}

// 前後文要去掉 marker 記號，視窗邊緣被切一半的 marker 也不能殘留。
func TestStorytellerReadableContextStripsMarkers(t *testing.T) {
	before := "⟦p-aaaaaaaaaaaa⟧很長很長的前文⟦/p-aaaaaaaaaaaa⟧\n⟦p-bbbbbbbbbbbb⟧前面⟦span-c1 color=\"red\"⟧紅字⟦/span-c1⟧"
	require.Equal(t, "前面紅字", storytellerReadableBefore(before, 4))
	require.Equal(t, "\n前面紅字", storytellerReadableBefore(before, 5))

	after := "之後的字⟦/p-bbbbbbbbbbbb⟧\n⟦p-cccccccccccc⟧下一段"
	require.Equal(t, "之後的字\n下一段", storytellerReadableAfter(after, 20))
	// 視窗 1*4+64 個 rune 會切在第二個 marker 中間，殘留的半個 marker 要清掉
	require.Equal(t, "甲", storytellerReadableAfter("甲⟦/p-"+strings.Repeat("x", 100)+"⟧乙", 1))
}
