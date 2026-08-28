package storyteller

import (
	"context"
	"testing"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"github.com/stretchr/testify/require"
)

func TestRunStoryAgenticQueryCallsToolThenPersistsChatAndUsage(t *testing.T) {
	providerAPIKeyID := uint64(50)
	repo := &fakeAgentRunRepository{
		project: &storytellerModel.Project{ID: 10, UserID: 20, PublicID: "project-public-id"},
		story:   &storytellerModel.Story{ID: 30, ProjectID: 10, PublicID: "story-public-id"},
		agent: &storytellerModel.Agent{
			ID:               40,
			UserID:           20,
			Provider:         storytellerModel.AgentProviderClaude,
			ModelName:        "claude-test",
			ProviderAPIKeyID: &providerAPIKeyID,
			DefaultPrompt:    "Be concise.",
		},
		providerAPIKey: encryptedTestProviderAPIKey(t, 50, 20, storytellerModel.AgentProviderClaude, "secret-key"),
	}

	callCount := 0
	responses := []*AIProviderResponse{
		{
			ToolCalls: []ToolCall{{ID: "toolu_1", Name: "storyteller_get_story", Arguments: map[string]interface{}{"story_public_id": "abc"}}},
		},
		{
			Result:       "這篇故事叫《測試故事》。",
			FinishReason: "end_turn",
			Usage:        &AIProviderUsage{InputTokens: 5, OutputTokens: 3, TotalTokens: 8},
		},
	}
	provider := &fakeSequentialAIProvider{
		onGenerate: func(req AIProviderRequest) (*AIProviderResponse, error) {
			resp := responses[callCount]
			callCount++
			return resp, nil
		},
	}

	toolCalled := false
	tools := []ToolSpec{{
		Name: "storyteller_get_story",
		Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
			toolCalled = true
			require.Equal(t, "abc", arguments["story_public_id"])
			return map[string]string{"title": "測試故事"}, nil
		},
	}}

	output, err := runStoryAgenticQuery(context.Background(), repo, func(agentProvider storytellerModel.AgentProvider, endpoint string) (AIProvider, error) {
		require.Equal(t, storytellerModel.AgentProviderClaude, agentProvider)
		return provider, nil
	}, tools, nil, 20, "project-public-id", "story-public-id", 40, "這篇故事叫什麼名字？", AgenticQueryOptions{})

	require.NoError(t, err)
	require.True(t, toolCalled)
	require.Equal(t, "這篇故事叫《測試故事》。", output.Result)
	require.Equal(t, uint64(40), output.AgentID)
	require.NotNil(t, output.Usage)
	require.Equal(t, 8, output.Usage.TotalTokens)

	// 對話歷史跟 usage log 都要透過既有的 CreateStoryChatWithMessages 一起存。
	require.NotNil(t, repo.chat)
	require.Equal(t, uint64(30), *repo.chat.StoryID)
	require.Len(t, repo.messages, 2)
	require.Equal(t, storytellerModel.ChatMessageRoleUser, repo.messages[0].Role)
	require.Equal(t, "這篇故事叫什麼名字？", repo.messages[0].Content)
	require.Equal(t, storytellerModel.ChatMessageRoleAssistant, repo.messages[1].Role)
	require.Contains(t, repo.messages[1].Metadata, "storyteller_get_story")
	require.NotNil(t, repo.usage)
	require.Equal(t, 8, repo.usage.TotalTokens)
	require.Equal(t, uint64(50), repo.usage.ProviderAPIKeyID)
}

// TestRunStoryAgenticQueryPropagatesStorytellerContextToTools 是一個迴歸測試：
// tool_registry_*.go 裡的真實工具（storyteller_get_story 等）都是靠
// storytellerUserIDFromContext／storytellerSourceFromContext 從 ctx 拿身分，不是
// 走參數傳遞。之前這個函式漏了在呼叫 RunAgentLoop 前把身分塞進 ctx，導致真實工具
// 呼叫必定失敗（"missing authenticated storyteller user"）——之前的測試都用不會
// 檢查 ctx 的假 Handler，沒測出這個洞。這裡故意寫一個會檢查 ctx 的假 Handler，
// 確保這個洞不會再回來。
func TestRunStoryAgenticQueryPropagatesStorytellerContextToTools(t *testing.T) {
	providerAPIKeyID := uint64(50)
	repo := &fakeAgentRunRepository{
		project: &storytellerModel.Project{ID: 10, UserID: 20, PublicID: "project-public-id"},
		story:   &storytellerModel.Story{ID: 30, ProjectID: 10, PublicID: "story-public-id"},
		agent: &storytellerModel.Agent{
			ID:               40,
			UserID:           20,
			Provider:         storytellerModel.AgentProviderClaude,
			ModelName:        "claude-test",
			ProviderAPIKeyID: &providerAPIKeyID,
		},
		providerAPIKey: encryptedTestProviderAPIKey(t, 50, 20, storytellerModel.AgentProviderClaude, "secret-key"),
	}
	callCount := 0
	provider := &fakeSequentialAIProvider{
		onGenerate: func(req AIProviderRequest) (*AIProviderResponse, error) {
			callCount++
			if callCount == 1 {
				return &AIProviderResponse{ToolCalls: []ToolCall{{ID: "toolu_1", Name: "check_context_tool"}}}, nil
			}
			return &AIProviderResponse{Result: "done"}, nil
		},
	}

	var observedUserID uint64
	var observedSource string
	tools := []ToolSpec{{
		Name: "check_context_tool",
		Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
			userID, err := storytellerUserIDFromContext(ctx)
			if err != nil {
				return nil, err
			}
			observedUserID = userID
			observedSource = storytellerSourceFromContext(ctx)
			return "ok", nil
		},
	}}

	output, err := runStoryAgenticQuery(context.Background(), repo, func(storytellerModel.AgentProvider, string) (AIProvider, error) {
		return provider, nil
	}, tools, nil, 20, "project-public-id", "story-public-id", 40, "問題", AgenticQueryOptions{})

	require.NoError(t, err)
	require.Equal(t, "done", output.Result)
	require.Equal(t, uint64(20), observedUserID)
	require.Equal(t, "agentic_query", observedSource)
}

// TestRunStoryAgenticQueryAppliesProviderAndModelOverride 驗證聊天視窗傳進來的
// key／model 覆寫（AgenticQueryOptions）會真的被套用，且跟 Agent 記錄的預設值
// 可以不一樣——呼應「Agent 只是人設/prompt，用哪把 key／哪個 model 是每次呼叫
// 當下的選擇」這個方向。
func TestRunStoryAgenticQueryAppliesProviderAndModelOverride(t *testing.T) {
	agentDefaultKeyID := uint64(50)
	overrideKeyID := uint64(51)
	repo := &fakeAgentRunRepository{
		project: &storytellerModel.Project{ID: 10, UserID: 20, PublicID: "project-public-id"},
		story:   &storytellerModel.Story{ID: 30, ProjectID: 10, PublicID: "story-public-id"},
		agent: &storytellerModel.Agent{
			ID:               40,
			UserID:           20,
			Provider:         storytellerModel.AgentProviderGrok,
			ModelName:        "grok-test",
			ProviderAPIKeyID: &agentDefaultKeyID,
		},
		providerAPIKey: encryptedTestProviderAPIKey(t, overrideKeyID, 20, storytellerModel.AgentProviderClaude, "override-secret-key"),
	}
	provider := &fakeSequentialAIProvider{
		onGenerate: func(req AIProviderRequest) (*AIProviderResponse, error) {
			require.Equal(t, "override-secret-key", req.APIKey)
			require.Equal(t, "claude-override-model", req.ModelName)
			return &AIProviderResponse{Result: "answered with claude"}, nil
		},
	}

	output, err := runStoryAgenticQuery(context.Background(), repo, func(agentProvider storytellerModel.AgentProvider, endpoint string) (AIProvider, error) {
		require.Equal(t, storytellerModel.AgentProviderClaude, agentProvider)
		return provider, nil
	}, nil, nil, 20, "project-public-id", "story-public-id", 40, "問題", AgenticQueryOptions{
		ProviderAPIKeyID: &overrideKeyID,
		ModelName:        "claude-override-model",
	})

	require.NoError(t, err)
	require.Equal(t, "answered with claude", output.Result)
	require.Equal(t, storytellerModel.AgentProviderClaude, output.Provider)
	require.Equal(t, "claude-override-model", output.ModelName)
}

func TestRunStoryAgenticQueryRejectsEmptyPrompt(t *testing.T) {
	output, err := runStoryAgenticQuery(context.Background(), &fakeAgentRunRepository{}, nil, nil, nil, 20, "project-public-id", "story-public-id", 40, "   ", AgenticQueryOptions{})
	require.Nil(t, output)
	require.ErrorIs(t, err, errAgenticQueryEmptyPrompt)
}

func TestRunStoryAgenticQueryPersistsUsageEvenWhenMaxStepsExceeded(t *testing.T) {
	providerAPIKeyID := uint64(50)
	repo := &fakeAgentRunRepository{
		project: &storytellerModel.Project{ID: 10, UserID: 20, PublicID: "project-public-id"},
		story:   &storytellerModel.Story{ID: 30, ProjectID: 10, PublicID: "story-public-id"},
		agent: &storytellerModel.Agent{
			ID:               40,
			UserID:           20,
			Provider:         storytellerModel.AgentProviderClaude,
			ModelName:        "claude-test",
			ProviderAPIKeyID: &providerAPIKeyID,
		},
		providerAPIKey: encryptedTestProviderAPIKey(t, 50, 20, storytellerModel.AgentProviderClaude, "secret-key"),
	}
	provider := &fakeSequentialAIProvider{
		onGenerate: func(req AIProviderRequest) (*AIProviderResponse, error) {
			return &AIProviderResponse{
				ToolCalls: []ToolCall{{ID: "toolu_x", Name: "noop_tool"}},
				Usage:     &AIProviderUsage{InputTokens: 1, OutputTokens: 1, TotalTokens: 2},
			}, nil
		},
	}
	tools := []ToolSpec{{
		Name: "noop_tool",
		Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
			return "ok", nil
		},
	}}

	output, err := runStoryAgenticQuery(context.Background(), repo, func(storytellerModel.AgentProvider, string) (AIProvider, error) {
		return provider, nil
	}, tools, nil, 20, "project-public-id", "story-public-id", 40, "一直呼叫工具的問題", AgenticQueryOptions{})

	require.ErrorIs(t, err, ErrAgentLoopMaxStepsExceeded)
	// 就算失控被中止，也要把已經燒掉的 usage 記下來，不能整批丟掉。
	require.NotNil(t, output)
	require.NotNil(t, repo.usage)
	require.Greater(t, repo.usage.TotalTokens, 0)
}

// fakeSequentialAIProvider 依序回傳不同的 response，讓測試可以模擬多輪對話
// （第一輪要工具、第二輪給答案），跟既有的 fakeAIProvider（只回一個固定 response）
// 不一樣。
type fakeSequentialAIProvider struct {
	onGenerate func(req AIProviderRequest) (*AIProviderResponse, error)
}

func (p *fakeSequentialAIProvider) Generate(ctx context.Context, req AIProviderRequest) (*AIProviderResponse, error) {
	return p.onGenerate(req)
}
