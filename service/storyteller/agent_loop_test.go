package storyteller

import (
	"context"
	"net/http"
	"testing"

	"github.com/stretchr/testify/require"
)

// TestRunAgentLoopExecutesToolThenReturnsFinalAnswer 模擬一次「先讀資料、再回答」
// 的完整迴圈：第一輪 Claude 回 tool_use 要求呼叫 storyteller_get_story，第二輪吃到
// 工具結果後給最終文字答案。這是 Phase 3.3「端對端手動驗證」在沒有真實 Claude API
// key 的情況下，用既有的 httptest transport mock 模式（見 ai_provider_test.go 的
// roundTripFunc）證明 loop 機制本身正確的替代做法——真正打真實 API 的驗證留給
// Faryne 之後自己用有效 API key 跑一次。
func TestRunAgentLoopExecutesToolThenReturnsFinalAnswer(t *testing.T) {
	callCount := 0
	client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		callCount++
		if callCount == 1 {
			return jsonResponse(http.StatusOK, `{
				"content": [
					{"type": "tool_use", "id": "toolu_1", "name": "get_story_title", "input": {"story_public_id": "abc"}}
				],
				"stop_reason": "tool_use",
				"usage": {"input_tokens": 10, "output_tokens": 6}
			}`), nil
		}
		return jsonResponse(http.StatusOK, `{
			"content": [{"type": "text", "text": "這篇故事叫《測試故事》。"}],
			"stop_reason": "end_turn",
			"usage": {"input_tokens": 20, "output_tokens": 8}
		}`), nil
	})}
	provider := NewClaudeProvider("https://example.test/messages", client)

	toolCalled := false
	tools := []ToolSpec{{
		Name:        "get_story_title",
		Description: "Get a story's title.",
		InputSchema: map[string]interface{}{"type": "object"},
		Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
			toolCalled = true
			require.Equal(t, "abc", arguments["story_public_id"])
			return map[string]string{"title": "測試故事"}, nil
		},
	}}

	result, err := RunAgentLoop(context.Background(), AgentLoopRequest{
		Provider:     provider,
		APIKey:       "test-key",
		ModelName:    "claude-test",
		SystemPrompt: "你是故事編輯助理。",
		UserPrompt:   "這篇故事叫什麼名字？",
		Tools:        tools,
	})

	require.NoError(t, err)
	require.True(t, toolCalled, "loop 應該真的執行工具，不是瞎猜答案")
	require.Equal(t, 2, callCount, "應該恰好呼叫兩輪 provider：第一輪要工具、第二輪給答案")
	require.Equal(t, "這篇故事叫《測試故事》。", result.FinalText)
	require.Len(t, result.Steps, 1)
	require.Len(t, result.Steps[0].ToolCalls, 1)
	require.Equal(t, "get_story_title", result.Steps[0].ToolCalls[0].Name)
	require.NoError(t, result.Steps[0].Results[0].Err)
	require.Contains(t, result.Steps[0].Results[0].Content, "測試故事")
}

// TestRunAgentLoopFeedsToolErrorBackInsteadOfAborting 確認單一工具呼叫失敗時，
// loop 不會整輪中止，而是把錯誤說明餵回去給模型自己決定下一步。
func TestRunAgentLoopFeedsToolErrorBackInsteadOfAborting(t *testing.T) {
	callCount := 0
	client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		callCount++
		if callCount == 1 {
			return jsonResponse(http.StatusOK, `{
				"content": [{"type": "tool_use", "id": "toolu_1", "name": "broken_tool", "input": {}}],
				"stop_reason": "tool_use"
			}`), nil
		}
		return jsonResponse(http.StatusOK, `{
			"content": [{"type": "text", "text": "工具失敗了，我改用其他方式回答。"}],
			"stop_reason": "end_turn"
		}`), nil
	})}
	provider := NewClaudeProvider("https://example.test/messages", client)

	tools := []ToolSpec{{
		Name:        "broken_tool",
		InputSchema: map[string]interface{}{"type": "object"},
		Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
			return nil, errAgentLoopTestToolFailure
		},
	}}

	result, err := RunAgentLoop(context.Background(), AgentLoopRequest{
		Provider:  provider,
		APIKey:    "test-key",
		ModelName: "claude-test",
		Tools:     tools,
	})

	require.NoError(t, err)
	require.Equal(t, "工具失敗了，我改用其他方式回答。", result.FinalText)
	require.Error(t, result.Steps[0].Results[0].Err)
	require.Contains(t, result.Steps[0].Results[0].Content, "error:")
}

// TestRunAgentLoopStopsAtMaxSteps 確認一直要求呼叫工具、不給最終答案時，loop 會
// 在安全上限被強制中止，不會無限燒 token。
func TestRunAgentLoopStopsAtMaxSteps(t *testing.T) {
	client := &http.Client{Transport: roundTripFunc(func(r *http.Request) (*http.Response, error) {
		return jsonResponse(http.StatusOK, `{
			"content": [{"type": "tool_use", "id": "toolu_x", "name": "noop_tool", "input": {}}],
			"stop_reason": "tool_use"
		}`), nil
	})}
	provider := NewClaudeProvider("https://example.test/messages", client)

	tools := []ToolSpec{{
		Name:        "noop_tool",
		InputSchema: map[string]interface{}{"type": "object"},
		Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
			return "ok", nil
		},
	}}

	result, err := RunAgentLoop(context.Background(), AgentLoopRequest{
		Provider:  provider,
		APIKey:    "test-key",
		ModelName: "claude-test",
		Tools:     tools,
	})

	require.Nil(t, result)
	require.ErrorIs(t, err, ErrAgentLoopMaxStepsExceeded)
}

var errAgentLoopTestToolFailure = &agentLoopTestError{"tool exploded"}

type agentLoopTestError struct{ msg string }

func (e *agentLoopTestError) Error() string { return e.msg }
