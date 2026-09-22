package storyteller

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestStorytellerProjectToolRegistrySplit(t *testing.T) {
	mainByName := toolSpecsByName(StorytellerToolRegistry().All())
	mcpOnlyByName := toolSpecsByName(StorytellerMCPOnlyToolRegistry().All())

	patch, ok := mainByName["storyteller_patch_project"]
	require.True(t, ok)
	require.ElementsMatch(t, []string{"project_public_id"}, patch.InputSchema["required"])
	require.NotContains(t, mcpOnlyByName, "storyteller_patch_project")

	create, ok := mcpOnlyByName["storyteller_create_project"]
	require.True(t, ok)
	require.ElementsMatch(t, []string{"name"}, create.InputSchema["required"])
	require.NotContains(t, mainByName, "storyteller_create_project")

	properties := create.InputSchema["properties"].(map[string]interface{})
	visibility := properties["visibility"].(map[string]interface{})
	require.ElementsMatch(t, []string{"public", "unlisted", "private"}, visibility["enum"])
	patchProperties := patch.InputSchema["properties"].(map[string]interface{})
	coverLayout := patchProperties["cover_layout"].(map[string]interface{})
	require.ElementsMatch(t, []string{"split", "immersive"}, coverLayout["enum"])
}

func TestStorytellerPatchProjectRejectsNoChanges(t *testing.T) {
	spec := toolSpecsByName(StorytellerToolRegistry().All())["storyteller_patch_project"]
	ctx := WithStorytellerUserID(t.Context(), 1)

	_, err := spec.Handler(ctx, map[string]interface{}{"project_public_id": "project-id"})

	require.ErrorIs(t, err, errStorytellerProjectPatchEmpty)
}

func toolSpecsByName(specs []ToolSpec) map[string]ToolSpec {
	byName := make(map[string]ToolSpec, len(specs))
	for _, spec := range specs {
		byName[spec.Name] = spec
	}
	return byName
}
