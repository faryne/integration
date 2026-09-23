package storyteller

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestPreviewPatchAndSearchReplace(t *testing.T) {
	doc := proposalPreviewDoc{Title: "舊標題", Summary: "摘要", Content: "甲乙甲"}

	require.NoError(t, proposalPreviewers["storyteller_patch_story"](&doc, map[string]interface{}{"title": "新標題"}))
	require.NoError(t, proposalPreviewers["storyteller_search_replace_story"](&doc, map[string]interface{}{"search": "甲", "replace": "丙"}))

	require.Equal(t, proposalPreviewDoc{Title: "新標題", Summary: "摘要", Content: "丙乙丙"}, doc)
}

// patch 只帶 content 時（例如 AI 重寫整篇某一幕後整份送回），標題/摘要維持原值。
func TestPreviewPatchLoreKeepsUntouchedFields(t *testing.T) {
	doc := proposalPreviewDoc{Title: "設定", Content: "舊內容"}

	require.NoError(t, proposalPreviewers["storyteller_patch_lore"](&doc, map[string]interface{}{"content": "新內容"}))

	require.Equal(t, proposalPreviewDoc{Title: "設定", Content: "新內容"}, doc)
}

func TestPreviewSearchReplaceRejectsEmptyMatch(t *testing.T) {
	doc := proposalPreviewDoc{Content: "甲乙"}

	require.Error(t, proposalPreviewers["storyteller_search_replace_lore"](&doc, map[string]interface{}{"search": "x*", "replace": "丙", "is_regex": true}))
}
