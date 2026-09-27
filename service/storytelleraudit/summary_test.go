package storytelleraudit

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestProjectDiffUsesAllowlist(t *testing.T) {
	before := map[string]any{
		"name": "舊名", "visibility": "private", "share_token": "secret-before", "latest_content": "full before",
	}
	after := map[string]any{
		"name": "新名", "visibility": "public", "share_token": "secret-after", "latest_content": "full after",
	}
	diff := ProjectDiff(before, after)
	changes := diff["changes"].(map[string]any)
	require.Equal(t, map[string]any{"before": "舊名", "after": "新名"}, changes["name"])
	require.Equal(t, map[string]any{"before": "private", "after": "public"}, changes["visibility"])
	require.NotContains(t, changes, "share_token")
	require.NotContains(t, changes, "latest_content")
}

func TestSafeSummaryNeverCopiesContent(t *testing.T) {
	summary := SafeSummary(
		map[string]any{"story_public_id": "story-1", "content": "全文", "base_version_id": 8},
		map[string]any{"public_id": "story-1", "latest_version_id": 9, "latest_content": "新全文"},
	)
	require.Equal(t, "story-1", summary["story_public_id"])
	require.Equal(t, float64(9), summary["latest_version_id"])
	require.NotContains(t, summary, "content")
	require.NotContains(t, summary, "latest_content")
}
