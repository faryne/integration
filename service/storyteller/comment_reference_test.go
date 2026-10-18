package storyteller

import (
	"testing"

	"github.com/stretchr/testify/require"
)

// 註解參照：合法的 refs 不報警告、也不影響字數；格式錯或超過上限只是 info，不擋存檔。
func TestCheckStoryContentFormatCommentRefs(t *testing.T) {
	ok := "⟦p1⟧她⟦comment-c1 comment=\"對齊口頭禪\" refs=\"lore:abc story:d-1\"⟧回頭⟦/comment-c1⟧看了一眼⟦/p1⟧"
	report := checkStoryContentFormat(ok)
	require.True(t, report.OK)
	require.Empty(t, report.Warnings)
	require.Equal(t, uint(7), wordCount(ok)) // 「她回頭看了一眼」，註解與 refs 不算字

	bad := "⟦p1⟧⟦comment-c1 comment=\"\" refs=\"lore:abc steamloom-lore://x a:1 b:2 c:3 d:4\"⟧字⟦/comment-c1⟧⟦/p1⟧"
	report = checkStoryContentFormat(bad)
	require.True(t, report.OK)
	require.ElementsMatch(t, []string{"invalid_comment_reference", "too_many_comment_references"}, warningCodes(report))
}

func TestStoryCommentRefs(t *testing.T) {
	refs, invalid, tooMany := storyCommentRefs("⟦comment-c1 comment=\"x\\\" refs=\\\"y\" refs=\"story:s1\"⟧a⟦/comment-c1⟧ ⟦a-l1 href=\"x\" refs=\"lore:no\"⟧b⟦/a-l1⟧")
	require.Equal(t, []storyCommentRef{{Kind: "story", PublicID: "s1"}}, refs)
	require.Empty(t, invalid)
	require.False(t, tooMany)
}
