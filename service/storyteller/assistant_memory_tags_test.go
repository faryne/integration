package storyteller

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNormalizeAssistantMemoryTagsTrimsAndDeduplicates(t *testing.T) {
	tags, err := normalizeAssistantMemoryTags([]string{" 角色口吻 ", "世界觀", "角色口吻", ""})

	require.NoError(t, err)
	require.Equal(t, []string{"角色口吻", "世界觀"}, tags)
	require.Equal(t, tags, decodeAssistantMemoryTags(encodeAssistantMemoryTags(tags)))
}

func TestNormalizeAssistantMemoryTagsRejectsOversizedInput(t *testing.T) {
	_, err := normalizeAssistantMemoryTags([]string{"一二三四五六七八九十一二三四五六七八九十一二三四五"})
	require.ErrorIs(t, err, ErrAssistantMemoryTagsInvalid)
}
