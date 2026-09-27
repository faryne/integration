package storyteller

import (
	"errors"
	"testing"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"github.com/stretchr/testify/require"
)

type fakeToolAuditLookup struct {
	projectLookups int
	projectBefore  int
	storyBefore    int
}

func (f *fakeToolAuditLookup) AuditProjectByPublicID(uint64, string) (*storytellerModel.Project, error) {
	f.projectLookups++
	return &storytellerModel.Project{ID: 42}, nil
}

func (f *fakeToolAuditLookup) ProjectBefore(uint64, string) (any, error) {
	f.projectBefore++
	return nil, errors.New("unexpected project snapshot")
}

func (f *fakeToolAuditLookup) Story(uint64, string) (*storytellerModel.Story, error) {
	f.storyBefore++
	return nil, errors.New("unexpected story snapshot")
}

func TestReadToolsOnlyResolveProjectID(t *testing.T) {
	for _, toolName := range []string{"storyteller_get_story", "storyteller_list_stories", "storyteller_search_memories"} {
		t.Run(toolName, func(t *testing.T) {
			lookup := &fakeToolAuditLookup{}
			action, mapped := storytellerModel.AuditActionForTool(toolName)
			require.True(t, mapped)
			state := loadToolAuditBefore(lookup, 7, "project-1", toolName, action.Name, map[string]interface{}{
				"project_public_id": "project-1",
				"story_public_id":   "story-1",
			})

			require.NotNil(t, state.projectID)
			require.Equal(t, uint64(42), *state.projectID)
			require.Equal(t, 1, lookup.projectLookups)
			require.Zero(t, lookup.projectBefore)
			require.Zero(t, lookup.storyBefore)
		})
	}
}

func TestStoryCreateToolOnlyResolvesProjectID(t *testing.T) {
	lookup := &fakeToolAuditLookup{}
	action, mapped := storytellerModel.AuditActionForTool("storyteller_upsert_story")
	require.True(t, mapped)
	state := loadToolAuditBefore(lookup, 7, "project-1", "storyteller_upsert_story", action.Name, map[string]interface{}{
		"project_public_id": "project-1",
	})

	require.NotNil(t, state.projectID)
	require.Equal(t, 1, lookup.projectLookups)
	require.Zero(t, lookup.projectBefore)
	require.Zero(t, lookup.storyBefore)
}
