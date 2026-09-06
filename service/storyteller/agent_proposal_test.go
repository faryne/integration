package storyteller

import (
	"context"
	"testing"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"github.com/stretchr/testify/require"
)

func TestCaptureWriteToolsAsProposalsDoesNotExecuteUnderlyingHandler(t *testing.T) {
	executed := false
	tools := []ToolSpec{
		{
			Name: "storyteller_upsert_story",
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				executed = true
				return "should never run", nil
			},
		},
		{
			Name: "storyteller_get_story",
			Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
				return "read tools pass through untouched", nil
			},
		},
	}

	captured := CaptureWriteToolsAsProposals(tools, map[string]bool{"storyteller_upsert_story": true})

	// 寫入工具：底層 Handler 完全不該被呼叫，回傳的是「已記錄、待確認」的合成訊息。
	result, err := captured[0].Handler(context.Background(), map[string]interface{}{"title": "新標題"})
	require.NoError(t, err)
	require.False(t, executed, "寫入類工具被攔截後，底層 Handler 不該被執行")
	require.Contains(t, result, "not applied")

	// 唯讀工具：不在攔截清單裡，原樣通過。
	result, err = captured[1].Handler(context.Background(), nil)
	require.NoError(t, err)
	require.Equal(t, "read tools pass through untouched", result)
}

func TestExtractProposalsOnlyCollectsWriteToolCalls(t *testing.T) {
	result := &AgentLoopResult{
		Steps: []AgentLoopStep{
			{
				ToolCalls: []ToolCall{
					{ID: "call_1", Name: "storyteller_get_story", Arguments: map[string]interface{}{"story_public_id": "abc"}},
					{ID: "call_2", Name: "storyteller_upsert_story", Arguments: map[string]interface{}{"title": "新標題"}},
				},
			},
			{
				ToolCalls: []ToolCall{
					{ID: "call_3", Name: "storyteller_delete_lore", Arguments: map[string]interface{}{"lore_public_id": "xyz"}},
				},
			},
		},
	}
	writeToolNames := map[string]bool{"storyteller_upsert_story": true, "storyteller_delete_lore": true}

	proposals := ExtractProposals(result, writeToolNames)

	require.Len(t, proposals, 2)
	require.Equal(t, "call_2", proposals[0].ToolCallID)
	require.Equal(t, "storyteller_upsert_story", proposals[0].ToolName)
	require.Equal(t, "新標題", proposals[0].Arguments["title"])
	require.Equal(t, "call_3", proposals[1].ToolCallID)
	require.Equal(t, "storyteller_delete_lore", proposals[1].ToolName)
}

func TestWriteStorytellerToolNamesExcludesReadOnly(t *testing.T) {
	writeNames := WriteStorytellerToolNames()
	require.True(t, writeNames["storyteller_upsert_story"])
	require.True(t, writeNames["storyteller_delete_story"])
	require.True(t, writeNames["storyteller_revert_story"])
	require.False(t, writeNames["storyteller_get_story"])
	require.False(t, writeNames["storyteller_list_stories"])
	require.False(t, writeNames["storyteller_list_projects"])
	for _, chapterTool := range []string{
		"storyteller_list_story_chapters",
		"storyteller_get_story_chapter",
		"storyteller_replace_story_chapter",
		"storyteller_insert_story_chapter",
		"storyteller_delete_story_chapter",
		"storyteller_list_lore_chapters",
		"storyteller_get_lore_chapter",
		"storyteller_replace_lore_chapter",
		"storyteller_insert_lore_chapter",
		"storyteller_delete_lore_chapter",
	} {
		require.Falsef(t, writeNames[chapterTool], "%s 不該進入 AAS proposal 寫入清單", chapterTool)
	}

	// list_projects 沒有 project_public_id，不能放進 skill read-only tools，也不是
	// 需要提案確認的寫入工具，所以 read/write 兩份清單會比 registry 少這一個。
	all := StorytellerToolRegistry().All()
	readOnly := ReadOnlyStorytellerTools()
	require.Equal(t, len(all)-1, len(readOnly)+len(writeNames))
}

func TestApplyAgentProposalRejectsToolNotInWriteAllowlist(t *testing.T) {
	repo := &fakeAgentRunRepository{
		project: &storytellerModel.Project{ID: 10, UserID: 20, PublicID: "project-public-id"},
	}

	// 唯讀工具不該能透過 ApplyAgentProposal 執行——那條路是給讀資料用的，不是
	// 拿來繞過提案機制直接呼叫任何工具的後門。
	_, err := applyAgentProposal(context.Background(), repo, 20, "project-public-id", "storyteller_get_story", nil)
	require.ErrorIs(t, err, ErrAgentProposalToolNotAllowed)

	// 完全不存在的工具名稱也要被拒絕，不能因為不在黑名單就放行。
	_, err = applyAgentProposal(context.Background(), repo, 20, "project-public-id", "not_a_real_tool", nil)
	require.ErrorIs(t, err, ErrAgentProposalToolNotAllowed)
}

func TestApplyAgentProposalChecksProjectAuthorizationBeforeExecuting(t *testing.T) {
	repo := &fakeAgentRunRepository{
		projectErr: errAgentProposalTestProjectNotFound,
	}

	_, err := applyAgentProposal(context.Background(), repo, 20, "someone-elses-project", "storyteller_upsert_story", map[string]interface{}{
		"project_public_id": "someone-elses-project",
		"title":             "test",
	})

	require.ErrorIs(t, err, errAgentProposalTestProjectNotFound)
}

var errAgentProposalTestProjectNotFound = agenticQueryError("project not found for this user")

// TestApplyAgentProposalRejectsArgumentsTargetingAnotherProject 是防呆的第二層：
// 就算 caller 對這個 project 有存取權，如果 arguments 裡的 project_public_id
// 跟 caller 宣稱要套用的 projectPublicID 對不上（例如提案資料被竄改，或呼叫端
// 傳錯），一樣要被 ScopeToolsToProject 擋下來，不能因為第一層的
// ProjectByPublicIDForUser 過了就跳過這層檢查——這是套用「真正」寫入工具
// （storyteller_upsert_story）而非假 ToolSpec 時才會踩到的路徑，用真實 registry
// 驗證 applyAgentProposal 真的有把 ScopeToolsToProject 接上去，不是只查了
// project 存不存在就直接放行。
func TestApplyAgentProposalRejectsArgumentsTargetingAnotherProject(t *testing.T) {
	repo := &fakeAgentRunRepository{
		project: &storytellerModel.Project{ID: 10, UserID: 20, PublicID: "authorized-project"},
	}

	_, err := applyAgentProposal(context.Background(), repo, 20, "authorized-project", "storyteller_upsert_story", map[string]interface{}{
		"project_public_id": "a-different-project",
		"title":             "test",
	})

	require.ErrorIs(t, err, ErrAgentToolScopeViolation)
}
