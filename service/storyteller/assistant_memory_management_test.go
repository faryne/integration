package storyteller

import (
	"testing"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"github.com/stretchr/testify/require"
)

func TestApplyAssistantMemoryInputSetsOnlySelectedScope(t *testing.T) {
	row := &storytellerModel.AssistantMemory{ProjectID: uint64Pointer(9), LoreID: uint64Pointer(8)}
	project := &storytellerModel.Project{ID: 10}
	story := &storytellerModel.Story{ID: 20}
	in := storytellerModel.AssistantMemoryUpdateRequest{
		MemoryName: " 主角的弱點 ", ScopeType: storytellerModel.AssistantMemoryScopeStory,
		Kind: storytellerModel.AssistantMemoryKindContext, Content: " 主角不會游泳。 ", Priority: 70, IsPinned: true,
	}

	require.NoError(t, applyAssistantMemoryInput(row, project, story, nil, in))
	require.Nil(t, row.ProjectID)
	require.Equal(t, uint64(20), *row.StoryID)
	require.Nil(t, row.LoreID)
	require.Equal(t, "主角的弱點", *row.MemoryName)
	require.Equal(t, "主角不會游泳。", row.Content)
	require.True(t, row.IsPinned)
}

func TestApplyAssistantMemoryInputRejectsUnavailableTargetScope(t *testing.T) {
	err := applyAssistantMemoryInput(
		&storytellerModel.AssistantMemory{},
		&storytellerModel.Project{ID: 10},
		&storytellerModel.Story{ID: 20},
		nil,
		storytellerModel.AssistantMemoryUpdateRequest{ScopeType: storytellerModel.AssistantMemoryScopeLore, Kind: storytellerModel.AssistantMemoryKindContext, Content: "內容"},
	)
	require.ErrorIs(t, err, ErrAssistantMemoryScopeInvalid)
}

func TestNormalizeAssistantMemoryContentIgnoresWhitespaceAndCase(t *testing.T) {
	require.Equal(t, normalizeAssistantMemoryContent("  Use   C++  "), normalizeAssistantMemoryContent("use c++"))
}

func TestApplyAssistantMemoryPatchPreservesOmittedFields(t *testing.T) {
	name := "原名稱"
	content := "只更新這個內容"
	row := &storytellerModel.AssistantMemory{
		MemoryName: &name, ScopeType: storytellerModel.AssistantMemoryScopeProject,
		ProjectID: uint64Pointer(10), Kind: storytellerModel.AssistantMemoryKindDecision,
		Content: "原內容", Priority: 80, IsPinned: true,
	}

	err := applyAssistantMemoryPatch(row, &storytellerModel.Project{ID: 10}, nil, nil, storytellerModel.AssistantMemoryUpsertRequest{Content: &content}, false)

	require.NoError(t, err)
	require.Equal(t, "原名稱", *row.MemoryName)
	require.Equal(t, "只更新這個內容", row.Content)
	require.Equal(t, uint8(80), row.Priority)
	require.True(t, row.IsPinned)
	require.Equal(t, storytellerModel.AssistantMemoryScopeProject, row.ScopeType)
}

func TestApplyAssistantMemoryPatchRequiresCreateFields(t *testing.T) {
	err := applyAssistantMemoryPatch(&storytellerModel.AssistantMemory{Priority: 50}, &storytellerModel.Project{ID: 10}, nil, nil, storytellerModel.AssistantMemoryUpsertRequest{}, true)
	require.ErrorIs(t, err, ErrAssistantMemoryScopeInvalid)
}

func TestAssistantMemoryBelongsToContextRejectsAnotherProjectAndSuperseded(t *testing.T) {
	project := &storytellerModel.Project{ID: 10}
	require.False(t, assistantMemoryBelongsToContext(&storytellerModel.AssistantMemory{
		ScopeType: storytellerModel.AssistantMemoryScopeProject, ProjectID: uint64Pointer(11),
	}, project, nil, nil))
	require.False(t, assistantMemoryBelongsToContext(&storytellerModel.AssistantMemory{
		ScopeType: storytellerModel.AssistantMemoryScopeProject, ProjectID: &project.ID, SupersededByID: uint64Pointer(12),
	}, project, nil, nil))
	require.True(t, assistantMemoryBelongsToContext(&storytellerModel.AssistantMemory{
		ScopeType: storytellerModel.AssistantMemoryScopeProject, ProjectID: &project.ID,
	}, project, nil, nil))
}

func TestAssistantMemoryScopeAllowedForProjectOnlyManagement(t *testing.T) {
	require.False(t, assistantMemoryScopeAllowedForContext(storytellerModel.AssistantMemoryScope("account"), nil, nil))
	require.True(t, assistantMemoryScopeAllowedForContext(storytellerModel.AssistantMemoryScopeProject, nil, nil))
	require.False(t, assistantMemoryScopeAllowedForContext(storytellerModel.AssistantMemoryScopeStory, nil, nil))
	require.True(t, assistantMemoryScopeAllowedForContext(storytellerModel.AssistantMemoryScopeStory, &storytellerModel.Story{}, nil))
}

func TestAssistantMemoryOutputIncludesTargetName(t *testing.T) {
	story := &storytellerModel.Story{PublicID: "story-1", Title: "雨夜的第三章"}
	output := assistantMemoryOutput(storytellerModel.AssistantMemory{
		PublicID: "memory-1", ScopeType: storytellerModel.AssistantMemoryScopeStory,
	}, &storytellerModel.Project{PublicID: "project-1", Name: "測試專案"}, story, nil)

	require.Equal(t, "story-1", output.TargetPublicID)
	require.Equal(t, "雨夜的第三章", output.TargetName)
}

func uint64Pointer(value uint64) *uint64 { return &value }
