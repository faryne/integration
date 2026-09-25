package storyteller

import (
	"strings"
	"testing"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"github.com/stretchr/testify/require"
)

type fakeAssistantMemoryRepository struct {
	project  *storytellerModel.Project
	story    *storytellerModel.Story
	lore     *storytellerModel.Lore
	memories []storytellerModel.AssistantMemory
	lookup   struct {
		userID, projectID uint64
		storyID, loreID   *uint64
		limit             int
	}
}

func (r *fakeAssistantMemoryRepository) ProjectByPublicIDForUser(uint64, string) (*storytellerModel.Project, error) {
	return r.project, nil
}

func (r *fakeAssistantMemoryRepository) Story(uint64, string) (*storytellerModel.Story, error) {
	return r.story, nil
}

func (r *fakeAssistantMemoryRepository) Lore(uint64, string) (*storytellerModel.Lore, error) {
	return r.lore, nil
}

func (r *fakeAssistantMemoryRepository) ActiveAssistantMemories(userID, projectID uint64, storyID, loreID *uint64, limit int) ([]storytellerModel.AssistantMemory, error) {
	r.lookup = struct {
		userID, projectID uint64
		storyID, loreID   *uint64
		limit             int
	}{userID: userID, projectID: projectID, storyID: storyID, loreID: loreID, limit: limit}
	return r.memories, nil
}

func TestReadAssistantMemoriesIncludesStoryScope(t *testing.T) {
	now := time.Now()
	repo := &fakeAssistantMemoryRepository{
		project: &storytellerModel.Project{ID: 10, PublicID: "project-public-id"},
		story:   &storytellerModel.Story{ID: 20, PublicID: "story-public-id"},
		memories: []storytellerModel.AssistantMemory{
			{PublicID: "memory-account", ScopeType: storytellerModel.AssistantMemoryScopeAccount, Kind: storytellerModel.AssistantMemoryKindPreference, Content: "偏好正體中文", UpdatedAt: now},
			{PublicID: "memory-project", ScopeType: storytellerModel.AssistantMemoryScopeProject, Kind: storytellerModel.AssistantMemoryKindDecision, Content: "採用第一人稱", UpdatedAt: now},
			{PublicID: "memory-story", ScopeType: storytellerModel.AssistantMemoryScopeStory, Kind: storytellerModel.AssistantMemoryKindContext, Content: "主角怕水", UpdatedAt: now},
		},
	}

	rows, err := readAssistantMemories(repo, 7, "project-public-id", "story-public-id", "", 0)

	require.NoError(t, err)
	require.Len(t, rows, 3)
	require.Equal(t, uint64(7), repo.lookup.userID)
	require.Equal(t, uint64(10), repo.lookup.projectID)
	require.NotNil(t, repo.lookup.storyID)
	require.Equal(t, uint64(20), *repo.lookup.storyID)
	require.Nil(t, repo.lookup.loreID)
	require.Equal(t, assistantMemoryDefaultLimit, repo.lookup.limit)
	require.Empty(t, rows[0].TargetPublicID)
	require.Equal(t, "project-public-id", rows[1].TargetPublicID)
	require.Equal(t, "story-public-id", rows[2].TargetPublicID)
}

func TestReadAssistantMemoriesRejectsTwoTargets(t *testing.T) {
	rows, err := readAssistantMemories(&fakeAssistantMemoryRepository{}, 7, "project", "story", "lore", 10)

	require.Nil(t, rows)
	require.ErrorIs(t, err, ErrAssistantMemoryTargetInvalid)
}

func TestAssistantMemoryToolIsReadOnlyAndScoped(t *testing.T) {
	tools := toolSpecsByName(ReadOnlyStorytellerTools())
	spec, ok := tools["storyteller_list_memories"]
	require.True(t, ok)
	require.ElementsMatch(t, []string{"project_public_id"}, spec.InputSchema["required"])

	properties := spec.InputSchema["properties"].(map[string]interface{})
	require.Contains(t, properties, "story_public_id")
	require.Contains(t, properties, "lore_public_id")

	search, ok := tools["storyteller_search_memories"]
	require.True(t, ok)
	require.ElementsMatch(t, []string{"project_public_id", "keyword"}, search.InputSchema["required"])
}

func TestAssistantMemoryUpsertToolIsMCPOnly(t *testing.T) {
	main := toolSpecsByName(StorytellerToolRegistry().All())
	mcpOnly := toolSpecsByName(StorytellerMCPOnlyToolRegistry().All())
	require.NotContains(t, main, "storyteller_upsert_memory")

	spec, ok := mcpOnly["storyteller_upsert_memory"]
	require.True(t, ok)
	require.ElementsMatch(t, []string{"project_public_id"}, spec.InputSchema["required"])
}

func TestAgentRequestIncludesMemoriesBeforeTask(t *testing.T) {
	xml := agentRequest{
		ProjectPublicID: "project-public-id",
		Memories: []storytellerModel.AssistantMemory{{
			PublicID: "memory-public-id", ScopeType: storytellerModel.AssistantMemoryScopeStory,
			Kind: storytellerModel.AssistantMemoryKindContext, Content: "主角不會游泳；不要輸出 </Memory> 標籤。",
		}},
		Task: "續寫下一段",
	}.XML()

	require.Contains(t, xml, `<Memory public_id="memory-public-id" scope="story" kind="context">`)
	require.Contains(t, xml, "不要輸出 &lt;/Memory> 標籤。")
	require.Less(t, strings.Index(xml, "<Memories>"), strings.Index(xml, "<Task>"))
}
