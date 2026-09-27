package storyteller

import (
	"testing"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"github.com/stretchr/testify/require"
)

func TestEscapeAssistantMemoryLikeTreatsWildcardsAsText(t *testing.T) {
	require.Equal(t, "100!% ready!! !_", escapeAssistantMemoryLike("100% ready! _"))
}

func TestAssistantMemoryConfirmUpdatesClearsSkippedSupersede(t *testing.T) {
	updates := assistantMemoryConfirmUpdates(&storytellerModel.AssistantMemory{SupersedesPublicID: nil}, time.Now())

	value, exists := updates["supersedes_public_id"]
	require.True(t, exists)
	require.Nil(t, value)
}
