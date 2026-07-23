package storyteller

import (
	"testing"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"github.com/stretchr/testify/require"
)

func TestBuildLoreVersion(t *testing.T) {
	lore := storytellerModel.Lore{
		ID:            42,
		Title:         "帝國曆法",
		LatestContent: "一年有十三個月。",
		WordCount:     8,
	}

	version := buildLoreVersion(lore, "web_manual")

	require.Equal(t, uint64(42), version.LoreID)
	require.Equal(t, "帝國曆法", version.Title)
	require.Equal(t, "一年有十三個月。", version.Content)
	require.Equal(t, "web_manual", version.Source)
	require.Equal(t, uint(8), version.WordCount)
}

func TestValidateLore(t *testing.T) {
	require.NoError(t, validateLore(storytellerModel.LoreRequest{
		Title:   "世界觀",
		Content: "內容",
	}))

	err := validateLore(storytellerModel.LoreRequest{Title: "   "})
	require.EqualError(t, err, "title is required")
}
