package storyteller

import (
	"encoding/json"
	"testing"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"github.com/stretchr/testify/require"
)

func TestStoryPatchArgumentsRequireContentField(t *testing.T) {
	parentID := "vol-1"
	require.False(t, storytellerPatchStoryArguments{ParentID: &parentID}.hasContentField())

	summary := ""
	require.True(t, storytellerPatchStoryArguments{Summary: &summary}.hasContentField())

	sort := 0
	require.True(t, storytellerPatchStoryArguments{Sort: &sort}.hasContentField())
}

func TestMergeStoryPatchPreservesOmittedFields(t *testing.T) {
	versionID := uint64(12)
	parentID := ""
	title := "新標題"
	sort := 0
	story := &storytellerModel.Story{
		Title:           "舊標題",
		Summary:         "舊摘要",
		Status:          storytellerModel.StoryStatusDraft,
		Sort:            9,
		LatestContent:   "舊內容",
		ContentType:     storytellerModel.ProjectContentTypeImage,
		LatestVersionID: &versionID,
	}

	input := mergeStoryPatch(story, storytellerPatchStoryArguments{Title: &title, Sort: &sort, ParentID: &parentID, BaseVersionID: &versionID})

	require.Equal(t, "新標題", input.Title)
	require.Equal(t, "舊摘要", input.Summary)
	require.Equal(t, storytellerModel.StoryStatusDraft, input.Status)
	require.Equal(t, 0, input.Sort)
	require.Equal(t, "舊內容", input.Content)
	require.Equal(t, storytellerModel.ProjectContentTypeImage, input.ContentType)
	require.Same(t, &parentID, input.ParentID)
	require.Same(t, &versionID, input.BaseVersionID)
}

func TestLorePatchArgumentsRequireContentField(t *testing.T) {
	collectionID := "collection-1"
	require.False(t, storytellerPatchLoreArguments{CollectionID: &collectionID}.hasContentField())

	content := ""
	require.True(t, storytellerPatchLoreArguments{Content: &content}.hasContentField())
}

func TestMergeLorePatchPreservesOmittedFields(t *testing.T) {
	versionID := uint64(22)
	collectionID := "__uncategorized__"
	content := "新內容"
	lore := &storytellerModel.Lore{Title: "舊標題", LatestContent: "舊內容", LatestVersionID: &versionID}

	input := mergeLorePatch(lore, storytellerPatchLoreArguments{Content: &content, CollectionID: &collectionID, BaseVersionID: &versionID})

	require.Equal(t, "舊標題", input.Title)
	require.Equal(t, "新內容", input.Content)
	require.Same(t, &collectionID, input.CollectionID)
	require.Same(t, &versionID, input.BaseVersionID)
}

func TestStorytellerRegistryIncludesPatchAndSearchReplaceTools(t *testing.T) {
	tools := StorytellerToolRegistry().All()
	byName := make(map[string]ToolSpec, len(tools))
	for _, spec := range tools {
		byName[spec.Name] = spec
	}

	for _, name := range []string{
		"storyteller_patch_story",
		"storyteller_search_replace_story",
		"storyteller_patch_lore",
		"storyteller_search_replace_lore",
	} {
		spec, ok := byName[name]
		require.Truef(t, ok, "%s should be registered", name)
		require.NotNil(t, spec.Handler)
		require.NotEmpty(t, spec.InputSchema)
	}

	require.Contains(t, schemaDescription(byName["storyteller_patch_story"].InputSchema, "title"), "Omit to keep")
	require.Contains(t, schemaDescription(byName["storyteller_search_replace_lore"].InputSchema, "is_regex"), "defaults to false")
}

func TestStorytellerRegistryIncludesAssetReplaceTools(t *testing.T) {
	tools := StorytellerToolRegistry().All()
	byName := make(map[string]ToolSpec, len(tools))
	for _, spec := range tools {
		byName[spec.Name] = spec
	}

	for _, name := range []string{
		"storyteller_presign_asset_replace",
		"storyteller_confirm_asset_replace",
	} {
		spec, ok := byName[name]
		require.Truef(t, ok, "%s should be registered", name)
		require.NotNil(t, spec.Handler)
		require.NotEmpty(t, spec.InputSchema)
		require.Contains(t, spec.Description, "IRREVERSIBLE")
		require.Contains(t, spec.Description, "no version history")
	}
}

func schemaDescription(schema map[string]interface{}, property string) string {
	props, _ := schema["properties"].(map[string]interface{})
	raw, _ := props[property].(map[string]interface{})
	desc, _ := raw["description"].(string)
	return desc
}

func TestSearchReplaceStatsJSONKeys(t *testing.T) {
	body, err := json.Marshal(storytellerSearchReplaceOutput{MatchCount: 2, TextMatchCount: 2})
	require.NoError(t, err)
	require.JSONEq(t, `{"match_count":2,"text_match_count":2,"image_description_match_count":0,"affected_pages":0}`, string(body))
}
