package storyteller

import (
	"context"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestScopeToolsToProjectBlocksMismatchedProject(t *testing.T) {
	called := false
	spec := ToolSpec{
		Name: "storyteller_get_story",
		Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
			called = true
			return "ok", nil
		},
	}

	scoped := ScopeToolsToProject([]ToolSpec{spec}, "authorized-project")

	// 帶錯 project_public_id：底層 Handler 完全不該被呼叫到。
	_, err := scoped[0].Handler(context.Background(), map[string]interface{}{
		"project_public_id": "someone-elses-project",
	})
	require.ErrorIs(t, err, ErrAgentToolScopeViolation)
	require.False(t, called, "跨專案的呼叫不該執行到底層 Handler")

	// 完全沒帶 project_public_id 也要擋下來，不能預設放行。
	_, err = scoped[0].Handler(context.Background(), map[string]interface{}{})
	require.ErrorIs(t, err, ErrAgentToolScopeViolation)
	require.False(t, called)

	// project_public_id 正確才會真的執行。
	result, err := scoped[0].Handler(context.Background(), map[string]interface{}{
		"project_public_id": "authorized-project",
	})
	require.NoError(t, err)
	require.True(t, called)
	require.Equal(t, "ok", result)
}

func TestReadOnlyStorytellerToolsExcludesWrites(t *testing.T) {
	tools := ReadOnlyStorytellerTools()
	require.NotEmpty(t, tools)
	for _, spec := range tools {
		require.Truef(t,
			hasPrefixAny(spec.Name, "storyteller_get_", "storyteller_list_"),
			"%s 不是 get_/list_ 開頭的唯讀工具，不該出現在 ReadOnlyStorytellerTools 裡", spec.Name)
	}
	// 交叉確認幾個明確是寫入/刪除的工具真的被排除。
	names := make(map[string]bool, len(tools))
	for _, spec := range tools {
		names[spec.Name] = true
	}
	for _, writeTool := range []string{
		"storyteller_upsert_story",
		"storyteller_delete_story",
		"storyteller_move_story",
		"storyteller_revert_story",
		"storyteller_delete_lore",
	} {
		require.Falsef(t, names[writeTool], "%s 是寫入類工具，不該出現在 ReadOnlyStorytellerTools 裡", writeTool)
	}
}

func hasPrefixAny(s string, prefixes ...string) bool {
	for _, p := range prefixes {
		if len(s) >= len(p) && s[:len(p)] == p {
			return true
		}
	}
	return false
}
