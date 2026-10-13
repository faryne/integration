package storyteller

import (
	"testing"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"github.com/stretchr/testify/require"
)

func TestConditionalWriteRequiresBaseVersion(t *testing.T) {
	t.Run("story", func(t *testing.T) {
		_, _, err := (&Service{}).UpdateStory(1, "project", "story", storytellerModel.StoryRequest{
			Title: "標題", Content: "內容", Status: storytellerModel.StoryStatusCompleted, AbortOnConflict: true,
		}, "mcp")
		require.EqualError(t, err, "base_version_id is required when abort_on_conflict is true")
	})

	t.Run("lore", func(t *testing.T) {
		_, _, err := (&Service{}).UpdateLore(1, "project", "lore", storytellerModel.LoreRequest{
			Title: "設定", Content: "內容", AbortOnConflict: true,
		}, "mcp")
		require.EqualError(t, err, "base_version_id is required when abort_on_conflict is true")
	})
}
