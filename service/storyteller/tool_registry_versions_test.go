package storyteller

import (
	"encoding/json"
	"testing"
	"time"

	"github.com/stretchr/testify/require"
)

func TestStorytellerRegistryIncludesVersionTools(t *testing.T) {
	tools := StorytellerToolRegistry().All()
	byName := make(map[string]ToolSpec, len(tools))
	for _, spec := range tools {
		byName[spec.Name] = spec
	}

	for _, tc := range []struct {
		name     string
		required []string
		desc     string
	}{
		{"storyteller_list_story_versions", []string{"project_public_id", "story_public_id"}, "storyteller_get_story_version"},
		{"storyteller_get_story_version", []string{"project_public_id", "story_public_id", "version_id"}, "storyteller_list_story_versions"},
		{"storyteller_list_lore_versions", []string{"project_public_id", "lore_public_id"}, "storyteller_get_lore_version"},
		{"storyteller_get_lore_version", []string{"project_public_id", "lore_public_id", "version_id"}, "storyteller_list_lore_versions"},
	} {
		spec, ok := byName[tc.name]
		require.Truef(t, ok, "%s should be registered", tc.name)
		require.NotNil(t, spec.Handler)
		require.NotEmpty(t, spec.InputSchema)
		require.Contains(t, spec.Description, tc.desc)
		require.ElementsMatch(t, tc.required, spec.InputSchema["required"])
	}

	require.NotContains(t, byName["storyteller_revert_story"].Description, "There is currently no MCP tool")
	require.Contains(t, byName["storyteller_revert_story"].Description, "storyteller_list_story_versions")
	require.NotContains(t, byName["storyteller_revert_lore"].Description, "There is currently no MCP tool")
	require.Contains(t, byName["storyteller_revert_lore"].Description, "storyteller_list_lore_versions")
}

func TestStorytellerChapterRegistrySplit(t *testing.T) {
	mainTools := StorytellerToolRegistry().All()
	mainByName := make(map[string]ToolSpec, len(mainTools))
	for _, spec := range mainTools {
		mainByName[spec.Name] = spec
	}
	mcpOnlyTools := StorytellerMCPOnlyToolRegistry().All()
	mcpOnlyByName := make(map[string]ToolSpec, len(mcpOnlyTools))
	for _, spec := range mcpOnlyTools {
		mcpOnlyByName[spec.Name] = spec
	}

	for _, name := range []string{
		"storyteller_list_story_chapters",
		"storyteller_get_story_chapter",
		"storyteller_list_lore_chapters",
		"storyteller_get_lore_chapter",
	} {
		spec, ok := mainByName[name]
		require.Truef(t, ok, "%s should be registered in main registry", name)
		require.NotNil(t, spec.Handler)
		require.NotEmpty(t, spec.InputSchema)
		require.NotContains(t, mcpOnlyByName, name)
	}
	for _, name := range []string{
		"storyteller_replace_story_chapter",
		"storyteller_insert_story_chapter",
		"storyteller_delete_story_chapter",
		"storyteller_replace_lore_chapter",
		"storyteller_insert_lore_chapter",
		"storyteller_delete_lore_chapter",
	} {
		spec, ok := mcpOnlyByName[name]
		require.Truef(t, ok, "%s should be registered in MCP-only registry", name)
		require.NotNil(t, spec.Handler)
		require.NotEmpty(t, spec.InputSchema)
		require.NotContains(t, mainByName, name)
	}
}

func TestStorytellerVersionSummaryJSONOmitsContent(t *testing.T) {
	createdAt := time.Date(2026, 9, 5, 12, 0, 0, 0, time.UTC)
	revertedFrom := uint64(10)
	conflictedWith := uint64(11)

	storyBody, err := json.Marshal(storytellerStoryVersionSummary{
		ID:                      12,
		Title:                   "標題",
		Summary:                 "摘要",
		WordCount:               34,
		RevertedFromVersionID:   &revertedFrom,
		ConflictedWithVersionID: &conflictedWith,
		CreatedAt:               createdAt,
	})
	require.NoError(t, err)
	require.JSONEq(t, `{"id":12,"title":"標題","summary":"摘要","word_count":34,"reverted_from_version_id":10,"conflicted_with_version_id":11,"created_at":"2026-09-05T12:00:00Z"}`, string(storyBody))
	require.NotContains(t, string(storyBody), "content")

	loreBody, err := json.Marshal(storytellerLoreVersionSummary{
		ID:                      13,
		Title:                   "設定",
		WordCount:               55,
		RevertedFromVersionID:   &revertedFrom,
		ConflictedWithVersionID: &conflictedWith,
		CreatedAt:               createdAt,
	})
	require.NoError(t, err)
	require.JSONEq(t, `{"id":13,"title":"設定","word_count":55,"reverted_from_version_id":10,"conflicted_with_version_id":11,"created_at":"2026-09-05T12:00:00Z"}`, string(loreBody))
	require.NotContains(t, string(loreBody), "content")
}
