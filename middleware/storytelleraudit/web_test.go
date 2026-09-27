package storytelleraudit

import (
	"errors"
	"testing"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"github.com/stretchr/testify/require"
)

type fakeWebAuditLookup struct {
	projectLookups int
	projectBefore  int
	storyBefore    int
}

func (f *fakeWebAuditLookup) AuditProjectByPublicID(uint64, string) (*storytellerModel.Project, error) {
	f.projectLookups++
	return &storytellerModel.Project{ID: 42}, nil
}

func (f *fakeWebAuditLookup) ProjectBefore(uint64, string) (any, error) {
	f.projectBefore++
	return nil, errors.New("unexpected project snapshot")
}

func (f *fakeWebAuditLookup) Story(uint64, string) (*storytellerModel.Story, error) {
	f.storyBefore++
	return nil, errors.New("unexpected story snapshot")
}

func TestResolvedWebStoryAction(t *testing.T) {
	versionID := uint64(10)
	story := &storytellerModel.Story{PublicID: "story-1", Sort: 1, LatestVersionID: &versionID}

	require.Equal(t, "story.move", resolvedWebStoryAction("story.update", story, map[string]any{
		"public_id": "story-1", "parent_id": 20, "sort": 2, "title": "", "summary": "", "status": "", "latest_version_id": 11,
	}))
	require.Equal(t, "story.reorder", resolvedWebStoryAction("story.update", story, map[string]any{
		"public_id": "story-1", "parent_id": nil, "sort": 2, "title": "", "summary": "", "status": "", "latest_version_id": 11,
	}))

	story.IsVolume = true
	require.Equal(t, "volume.delete", resolvedWebStoryAction("story.delete", story, nil))
}

func TestRouteTemplateMatches(t *testing.T) {
	require.True(t, routeTemplateMatches("/storyteller/projects/:project/stories/:story", "/storyteller/projects/p1/stories/s1"))
	require.False(t, routeTemplateMatches("/storyteller/projects/:project/stories/:story", "/storyteller/projects/p1/stories"))
}

func TestStoryCreateOnlyResolvesProjectID(t *testing.T) {
	lookup := &fakeWebAuditLookup{}
	path := "/storyteller/projects/project-1/stories"
	action, mapped := auditActionForRequest("POST", path)
	require.True(t, mapped)
	state := loadWebAuditBefore(lookup, 7, projectPublicIDFromPath(path), action.Name, storyPublicIDFromPath(path))

	require.NotNil(t, state.projectID)
	require.Equal(t, uint64(42), *state.projectID)
	require.Equal(t, 1, lookup.projectLookups)
	require.Zero(t, lookup.projectBefore)
	require.Zero(t, lookup.storyBefore)
}
