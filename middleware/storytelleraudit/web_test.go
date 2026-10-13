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

	// PATCH 不寫版本：只有 sort 變動也要認成排序
	require.Equal(t, "story.reorder", resolvedWebStoryAction("story.update", story, map[string]any{
		"public_id": "story-1", "parent_id": nil, "sort": 2, "title": "", "summary": "", "status": "", "latest_version_id": 10,
	}))

	story.IsVolume = true
	require.Equal(t, "volume.delete", resolvedWebStoryAction("story.delete", story, nil))
	// 冊透過 stories 路徑的 PATCH：排序記成 volume.reorder，其他（例如狀態）記成 volume.update
	require.Equal(t, "volume.reorder", resolvedWebStoryAction("story.update", story, map[string]any{
		"public_id": "story-1", "parent_id": nil, "sort": 3, "title": "", "summary": "", "status": "", "latest_version_id": 10,
	}))
	require.Equal(t, "volume.update", resolvedWebStoryAction("story.update", story, map[string]any{
		"public_id": "story-1", "parent_id": nil, "sort": 1, "title": "", "summary": "", "status": "completed", "latest_version_id": 10,
	}))
}

func TestResolvedWebLoreAction(t *testing.T) {
	// PATCH 帶 collection_id＝搬移設定集；只改狀態＝一般更新；整篇 PUT 不受影響
	require.Equal(t, "lore.move", resolvedWebLoreAction("lore.update", "PATCH", map[string]any{"collection_id": ""}))
	require.Equal(t, "lore.update", resolvedWebLoreAction("lore.update", "PATCH", map[string]any{"status": "completed"}))
	require.Equal(t, "lore.update", resolvedWebLoreAction("lore.update", "PUT", map[string]any{"collection_id": "c1"}))
	require.Equal(t, "story.update", resolvedWebLoreAction("story.update", "PATCH", map[string]any{"collection_id": "c1"}))
}

func TestRouteTemplateMatches(t *testing.T) {
	require.True(t, routeTemplateMatches("/storyteller/projects/:project/stories/:story", "/storyteller/projects/p1/stories/s1"))
	require.False(t, routeTemplateMatches("/storyteller/projects/:project/stories/:story", "/storyteller/projects/p1/stories"))
}

func TestProjectPublicIDFromReadingBookmarkPath(t *testing.T) {
	require.Equal(t, "project-1", projectPublicIDFromPath("/storyteller/story/project-1/stories/story-1/bookmarks"))
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
