package storyteller

import (
	"encoding/json"
	"testing"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"github.com/stretchr/testify/require"
)

func TestCompileStorytellerSearchPatternEscapesLiteralSearch(t *testing.T) {
	pattern, err := compileStorytellerSearchPattern("Lux.Oris?", false)
	require.NoError(t, err)

	replaced, count := replaceAllCounting(pattern, "Lux.Oris? LuxxOris?", "LUXORIS")

	require.Equal(t, 1, count)
	require.Equal(t, "LUXORIS LuxxOris?", replaced)
}

func TestCompileStorytellerSearchPatternReturnsRegexError(t *testing.T) {
	_, err := compileStorytellerSearchPattern("(", true)
	require.Error(t, err)
	require.Contains(t, err.Error(), "invalid search pattern")
	require.Contains(t, err.Error(), "missing closing")
}

func TestReplaceStoryContentTextSupportsRegexCaptureReferences(t *testing.T) {
	pattern, err := compileStorytellerSearchPattern(`Lux(Oris)`, true)
	require.NoError(t, err)

	result, err := replaceStoryContent(storytellerModel.ProjectContentTypeText, "LuxOris / LuxOris", pattern, "LUX$1")

	require.NoError(t, err)
	require.Equal(t, "LUXOris / LUXOris", result.Content)
	require.Equal(t, 2, result.MatchCount)
	require.Equal(t, 2, result.TextMatchCount)
	require.Equal(t, 0, result.ImageDescriptionMatchCount)
	require.Equal(t, 0, result.AffectedPages)
}

func TestReplaceStoryContentImageOnlyChangesPageDescriptions(t *testing.T) {
	rawContent := `{"pages":[{"id":"LuxOris","key":"LuxOris/key.png","asset_public_id":"asset-1","description":"LuxOris 第一頁 LuxOris","sort":0},{"id":"page-2","key":"keep/key.png","description":"沒有命中","sort":1}]}`
	pattern, err := compileStorytellerSearchPattern("LuxOris", false)
	require.NoError(t, err)

	result, err := replaceStoryContent(storytellerModel.ProjectContentTypeImage, rawContent, pattern, "LUXORIS")
	require.NoError(t, err)

	var content storytellerModel.StoryImageContent
	require.NoError(t, json.Unmarshal([]byte(result.Content), &content))
	require.Equal(t, "LuxOris", content.Pages[0].ID)
	require.Equal(t, "LuxOris/key.png", content.Pages[0].Key)
	require.Equal(t, "LUXORIS 第一頁 LUXORIS", content.Pages[0].Description)
	require.Equal(t, "沒有命中", content.Pages[1].Description)
	require.Equal(t, 2, result.MatchCount)
	require.Equal(t, 0, result.TextMatchCount)
	require.Equal(t, 2, result.ImageDescriptionMatchCount)
	require.Equal(t, 1, result.AffectedPages)
}

func TestReplaceStoryContentImageNoMatchKeepsRawContent(t *testing.T) {
	rawContent := `{"pages":[{"id":"page-1","key":"k.png","description":"沒有命中","sort":0}]}`
	pattern, err := compileStorytellerSearchPattern("LuxOris", false)
	require.NoError(t, err)

	result, err := replaceStoryContent(storytellerModel.ProjectContentTypeImage, rawContent, pattern, "LUXORIS")

	require.NoError(t, err)
	require.Equal(t, rawContent, result.Content)
	require.Equal(t, 0, result.MatchCount)
	require.Equal(t, 0, result.AffectedPages)
}
