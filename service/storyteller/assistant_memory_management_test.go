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

func uint64Pointer(value uint64) *uint64 { return &value }
