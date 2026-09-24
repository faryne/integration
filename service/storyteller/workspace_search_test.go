package storyteller

import (
	"strings"
	"testing"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"github.com/stretchr/testify/require"
)

func TestWorkspaceSearchExcerptKeepsKeywordContext(t *testing.T) {
	text := "開頭的背景說明很長，這裡還不是重點。艾莉絲在港口看見信號燈亮了第三次，決定回頭確認。後面還有其他內容。"
	excerpt := workspaceSearchExcerpt(text, "艾莉絲", 24)
	require.Contains(t, excerpt, "艾莉絲")
	require.LessOrEqual(t, len([]rune(excerpt)), 26)
}

func TestWorkspaceSearchSourceMatchesVisibleTextOnly(t *testing.T) {
	markerStory := storytellerModel.WorkspaceSearchSource{
		Kind:    storytellerModel.WorkspaceSearchKindStory,
		Title:   "港口",
		Content: `⟦30f0b2cf⟧艾莉⟦span-color id="hidden-marker"⟧絲⟦/span-color⟧抵達港口⟦/30f0b2cf⟧`,
	}
	require.True(t, workspaceSearchSourceMatches(markerStory, "艾莉絲"))
	require.False(t, workspaceSearchSourceMatches(markerStory, "30f0b2cf"))
	require.False(t, workspaceSearchSourceMatches(markerStory, "id="))

	imageStory := storytellerModel.WorkspaceSearchSource{
		Kind:        storytellerModel.WorkspaceSearchKindStory,
		ContentType: storytellerModel.ProjectContentTypeImage,
		Title:       "港口插圖",
		Content:     `{"pages":[{"key":"hidden.png","sort":0,"description":"艾莉絲看見燈塔"}]}`,
	}
	require.True(t, workspaceSearchSourceMatches(imageStory, "燈塔"))
	require.False(t, workspaceSearchSourceMatches(imageStory, "key"))
	require.False(t, workspaceSearchSourceMatches(imageStory, "hidden.png"))
}

func TestWorkspaceSearchExcerptUnicodeCaseFoldDoesNotPanic(t *testing.T) {
	require.NotPanics(t, func() {
		excerpt := workspaceSearchExcerpt(strings.Repeat("İ", 30)+"NEEDLE"+strings.Repeat("後", 30), "needle", 24)
		require.Contains(t, excerpt, "NEEDLE")
	})
}

func TestWorkspaceSearchPlainTextStripsMarkdownForPreview(t *testing.T) {
	source := storytellerModel.WorkspaceSearchSource{
		Kind: storytellerModel.WorkspaceSearchKindStory,
		Content: "# 測試標題\n" +
			"這是 `inline` 與 **粗體**。\n" +
			"```go\nfmt.Println(\"ok\")\n```",
	}
	require.Equal(t, "測試標題\n這是 inline 與 粗體。\n\nfmt.Println(\"ok\")", workspaceSearchPlainText(source))
}

func TestWorkspaceSearchPlainTextKeepsUnpairedInlineDelimiters(t *testing.T) {
	source := storytellerModel.WorkspaceSearchSource{
		Kind: storytellerModel.WorkspaceSearchKindStory,
		Content: "他說 C++ 很難寫\n" +
			"好啦~等我一下\n" +
			"2^10 等於 1024\n" +
			"只有一個 * 跟 ` 也要保留",
	}
	require.Equal(t, source.Content, workspaceSearchPlainText(source))
	require.True(t, workspaceSearchSourceMatches(source, "C++"))
	require.True(t, workspaceSearchSourceMatches(source, "好啦~"))
	require.True(t, workspaceSearchSourceMatches(source, "2^10"))
}

func TestWorkspaceSearchLocation(t *testing.T) {
	require.Equal(t, "作品與冊／未分冊", workspaceSearchLocation(storytellerModel.WorkspaceSearchSource{Kind: storytellerModel.WorkspaceSearchKindStory}))
	require.Equal(t, "設定集／角色", workspaceSearchLocation(storytellerModel.WorkspaceSearchSource{Kind: storytellerModel.WorkspaceSearchKindLore, CollectionName: "角色"}))
	require.Equal(t, "資產庫／未分類", workspaceSearchLocation(storytellerModel.WorkspaceSearchSource{Kind: storytellerModel.WorkspaceSearchKindAsset}))
}
