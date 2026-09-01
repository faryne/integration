package storyteller

import (
	"context"
	"encoding/json"
	"testing"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/service/background"
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

func TestAgenticQueryHistoryMessagesMarksAssistantPersonaOnly(t *testing.T) {
	agentID := uint64(41)
	rows := []storytellerModel.StoryChatMessage{
		{ID: 1, ChatID: 10, Role: storytellerModel.ChatMessageRoleUser, Content: "上一輪需求", AgentID: &agentID},
		{ID: 2, ChatID: 10, Role: storytellerModel.ChatMessageRoleAssistant, Content: "上一輪回答", AgentID: &agentID},
		{ID: 3, ChatID: 11, Role: storytellerModel.ChatMessageRoleUser, Content: "一般問答"},
		{ID: 4, ChatID: 11, Role: storytellerModel.ChatMessageRoleAssistant, Content: "無人設回答"},
	}

	messages := agenticQueryHistoryMessages(rows, map[uint64]string{agentID: "色文作家"})

	require.Len(t, messages, 4)
	require.Equal(t, "上一輪需求", messages[0].Content)
	require.Contains(t, messages[1].Content, `persona_name="色文作家"`)
	require.Contains(t, messages[1].Content, "do not imitate this persona")
	require.Contains(t, messages[1].Content, "<<<STORYTELLER_HISTORY_ASSISTANT_MESSAGE_2_CONTENT")
	require.Contains(t, messages[1].Content, "上一輪回答")
	require.Equal(t, "一般問答", messages[2].Content)
	require.Equal(t, "無人設回答", messages[3].Content)
}

func TestRunStoryAgenticQueryAnnotatesHistoryWithBatchAgentNames(t *testing.T) {
	providerAPIKeyID := uint64(50)
	oldAgentID := uint64(41)
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
		agentsByID:     []storytellerModel.Agent{{ID: oldAgentID, UserID: 20, Name: "文言文"}},
		providerAPIKey: encryptedTestProviderAPIKey(t, 50, 20, storytellerModel.AgentProviderClaude, "secret-key"),
		historyMessages: []storytellerModel.StoryChatMessage{
			{ID: 1, ChatID: 10, Role: storytellerModel.ChatMessageRoleUser, Content: "把前段改寫", AgentID: &oldAgentID},
			{ID: 2, ChatID: 10, Role: storytellerModel.ChatMessageRoleAssistant, Content: "臣聞前段", AgentID: &oldAgentID},
		},
	}
	provider := &fakeSequentialAIProvider{
		onGenerate: func(req AIProviderRequest) (*AIProviderResponse, error) {
			require.Equal(t, []uint64{oldAgentID}, repo.agentsByIDLookup.ids)
			require.Equal(t, uint64(20), repo.agentsByIDLookup.userID)
			require.Len(t, req.Messages, 3)
			require.Equal(t, "把前段改寫", req.Messages[0].Content)
			require.Contains(t, req.Messages[1].Content, `persona_name="文言文"`)
			require.Contains(t, req.Messages[1].Content, "臣聞前段")
			require.Contains(t, req.SystemPrompt, "metadata fences that name the persona")
			return &AIProviderResponse{Result: "這輪回答"}, nil
		},
	}

	output, err := runStoryAgenticQuery(context.Background(), repo, func(storytellerModel.AgentProvider, string) (AIProvider, error) {
		return provider, nil
	}, nil, nil, 20, "project-public-id", "story-public-id", 40, "這輪問題", AgenticQueryOptions{})

	require.NoError(t, err)
	require.Equal(t, "這輪回答", output.Result)
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

func TestEnqueueStoryAgenticQueryReturnsInProgressAndBackgroundPersistsResult(t *testing.T) {
	providerAPIKeyID := uint64(50)
	repo := &fakeAgentRunRepository{
		project: &storytellerModel.Project{ID: 10, UserID: 20, PublicID: "project-public-id"},
		story:   &storytellerModel.Story{ID: 30, ProjectID: 10, PublicID: "story-public-id", Title: "測試故事"},
		agent: &storytellerModel.Agent{
			ID:               40,
			UserID:           20,
			Provider:         storytellerModel.AgentProviderClaude,
			ModelName:        "claude-test",
			ProviderAPIKeyID: &providerAPIKeyID,
		},
		providerAPIKey: encryptedTestProviderAPIKey(t, 50, 20, storytellerModel.AgentProviderClaude, "secret-key"),
	}
	started := make(chan struct{})
	release := make(chan struct{})
	provider := &contextCheckingAIProvider{
		onGenerate: func(ctx context.Context, req AIProviderRequest) (*AIProviderResponse, error) {
			close(started)
			<-release
			require.NoError(t, ctx.Err())
			return &AIProviderResponse{Result: "背景回答", Usage: &AIProviderUsage{TotalTokens: 3}}, nil
		},
	}
	tracker := background.NewTracker()
	reqCtx, cancelRequest := context.WithCancel(context.Background())
	output, err := enqueueStoryAgenticQuery(reqCtx, repo, tracker, func(storytellerModel.AgentProvider, string) (AIProvider, error) {
		return provider, nil
	}, nil, nil, 20, "project-public-id", "story-public-id", 40, "問題", AgenticQueryOptions{})

	require.NoError(t, err)
	require.Equal(t, storytellerModel.StoryChatStatusInProgress, output.ChatStatus)
	require.Len(t, repo.messages, 1)
	cancelRequest()
	select {
	case <-started:
	case <-time.After(time.Second):
		t.Fatal("background provider call did not start")
	}
	close(release)
	tracker.BeginDrain()
	tracker.Wait()

	require.Equal(t, storytellerModel.StoryChatStatusCompleted, repo.chat.Status)
	require.Len(t, repo.messages, 2)
	require.Equal(t, storytellerModel.ChatMessageRoleAssistant, repo.messages[1].Role)
	require.Equal(t, "背景回答", repo.messages[1].Content)
	require.NotNil(t, repo.usage)
	require.Equal(t, 3, repo.usage.TotalTokens)
}

func TestEnqueueStoryAgenticQueryRejectsWhenBackgroundWorkIsDraining(t *testing.T) {
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
	tracker := background.NewTracker()
	tracker.BeginDrain()
	output, err := enqueueStoryAgenticQuery(context.Background(), repo, tracker, func(storytellerModel.AgentProvider, string) (AIProvider, error) {
		return &fakeSequentialAIProvider{}, nil
	}, nil, nil, 20, "project-public-id", "story-public-id", 40, "問題", AgenticQueryOptions{})

	require.Nil(t, output)
	require.ErrorIs(t, err, ErrAgenticQueryServerDraining)
	require.Nil(t, repo.chat)
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

func TestRunStoryAgenticQueryPersistsMessageReferenceAndResendRebuildsSamePrompt(t *testing.T) {
	providerAPIKeyID := uint64(50)
	replyMessageID := uint64(77)
	userPrompt := "> 回覆 AI 助理：這是摘要\n\n請接著回答"
	replyContent := "這是被回覆訊息的完整原文\n第二行也要保留"
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
		storyMessage:   &storytellerModel.StoryChatMessage{ID: replyMessageID, Content: replyContent},
	}
	expectedPrompt := agenticQueryUserPromptWithReply(userPrompt, replyContent)
	var initialPrompt string
	initialProvider := &fakeSequentialAIProvider{
		onGenerate: func(req AIProviderRequest) (*AIProviderResponse, error) {
			initialPrompt = req.Messages[len(req.Messages)-1].Content
			return &AIProviderResponse{Result: "初次回答"}, nil
		},
	}

	output, err := runStoryAgenticQuery(context.Background(), repo, func(storytellerModel.AgentProvider, string) (AIProvider, error) {
		return initialProvider, nil
	}, nil, nil, 20, "project-public-id", "story-public-id", 40, userPrompt, AgenticQueryOptions{
		ReplyContent: replyContent,
		ReplyReference: &storytellerModel.AgenticReplyReferenceRequest{
			Kind:      "message",
			MessageID: replyMessageID,
			Summary:   "> 回覆 AI 助理：這是摘要",
		},
	})

	require.NoError(t, err)
	require.Equal(t, expectedPrompt, initialPrompt)
	require.Equal(t, uint64(1001), output.UserMessageID)
	require.Equal(t, uint64(1002), output.AssistantMessageID)
	require.NotContains(t, repo.messages[0].Metadata, "reply_content")
	require.NotContains(t, repo.messages[0].Metadata, replyContent)
	var metadata struct {
		ReplyReference struct {
			Kind      string `json:"kind"`
			MessageID uint64 `json:"message_id"`
			Summary   string `json:"summary"`
		} `json:"reply_reference"`
	}
	require.NoError(t, json.Unmarshal([]byte(repo.messages[0].Metadata), &metadata))
	require.Equal(t, "message", metadata.ReplyReference.Kind)
	require.Equal(t, replyMessageID, metadata.ReplyReference.MessageID)
	require.Equal(t, "> 回覆 AI 助理：這是摘要", metadata.ReplyReference.Summary)

	repo.claimResult = 1
	repo.pendingUserMessage = &repo.messages[0]
	var resendPrompt string
	resendProvider := &fakeSequentialAIProvider{
		onGenerate: func(req AIProviderRequest) (*AIProviderResponse, error) {
			resendPrompt = req.Messages[len(req.Messages)-1].Content
			return &AIProviderResponse{Result: "重送回答"}, nil
		},
	}
	resendOutput, err := resendStoryAgenticQuery(context.Background(), repo, func(storytellerModel.AgentProvider, string) (AIProvider, error) {
		return resendProvider, nil
	}, nil, nil, 20, "project-public-id", "story-public-id", 40, repo.chat.ID, AgenticQueryOptions{})

	require.NoError(t, err)
	require.Equal(t, "重送回答", resendOutput.Result)
	require.Equal(t, expectedPrompt, resendPrompt)
}

func TestRunStoryAgenticQueryPersistsProposalReferenceAndResendRebuildsSamePrompt(t *testing.T) {
	providerAPIKeyID := uint64(50)
	proposal := &storytellerModel.AgentProposal{
		PublicID:  "proposal-public-id",
		ToolName:  "storyteller_upsert_story",
		Arguments: `{"content":"提案完整內容","story_public_id":"story-public-id","title":"新標題"}`,
	}
	userPrompt := "> 否決提案 #1：更新故事內容（新標題）\n\n請改小一點"
	replyContent := agenticQueryProposalReferenceContent(proposal)
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
		providerAPIKey:  encryptedTestProviderAPIKey(t, 50, 20, storytellerModel.AgentProviderClaude, "secret-key"),
		projectProposal: proposal,
	}
	expectedPrompt := agenticQueryUserPromptWithReply(userPrompt, replyContent)
	var initialPrompt string
	initialProvider := &fakeSequentialAIProvider{
		onGenerate: func(req AIProviderRequest) (*AIProviderResponse, error) {
			initialPrompt = req.Messages[len(req.Messages)-1].Content
			return &AIProviderResponse{Result: "初次回答"}, nil
		},
	}

	_, err := runStoryAgenticQuery(context.Background(), repo, func(storytellerModel.AgentProvider, string) (AIProvider, error) {
		return initialProvider, nil
	}, nil, nil, 20, "project-public-id", "story-public-id", 40, userPrompt, AgenticQueryOptions{
		ReplyContent: replyContent,
		ReplyReference: &storytellerModel.AgenticReplyReferenceRequest{
			Kind:             "proposal",
			ProposalPublicID: proposal.PublicID,
			Summary:          "> 否決提案 #1：更新故事內容（新標題）",
		},
	})

	require.NoError(t, err)
	require.Equal(t, expectedPrompt, initialPrompt)
	require.NotContains(t, repo.messages[0].Metadata, "reply_content")
	require.NotContains(t, repo.messages[0].Metadata, "提案完整內容")
	var metadata struct {
		ReplyReference struct {
			Kind             string `json:"kind"`
			ProposalPublicID string `json:"proposal_public_id"`
			Summary          string `json:"summary"`
		} `json:"reply_reference"`
	}
	require.NoError(t, json.Unmarshal([]byte(repo.messages[0].Metadata), &metadata))
	require.Equal(t, "proposal", metadata.ReplyReference.Kind)
	require.Equal(t, proposal.PublicID, metadata.ReplyReference.ProposalPublicID)
	require.Equal(t, "> 否決提案 #1：更新故事內容（新標題）", metadata.ReplyReference.Summary)

	repo.claimResult = 1
	repo.pendingUserMessage = &repo.messages[0]
	var resendPrompt string
	resendProvider := &fakeSequentialAIProvider{
		onGenerate: func(req AIProviderRequest) (*AIProviderResponse, error) {
			resendPrompt = req.Messages[len(req.Messages)-1].Content
			return &AIProviderResponse{Result: "重送回答"}, nil
		},
	}
	resendOutput, err := resendStoryAgenticQuery(context.Background(), repo, func(storytellerModel.AgentProvider, string) (AIProvider, error) {
		return resendProvider, nil
	}, nil, nil, 20, "project-public-id", "story-public-id", 40, repo.chat.ID, AgenticQueryOptions{})

	require.NoError(t, err)
	require.Equal(t, "重送回答", resendOutput.Result)
	require.Equal(t, expectedPrompt, resendPrompt)
}

func TestStoryChatMessageReferenceContentUsesUserStoryScopedLookup(t *testing.T) {
	repo := &fakeAgentRunRepository{
		project:      &storytellerModel.Project{ID: 10, UserID: 20, PublicID: "project-public-id"},
		story:        &storytellerModel.Story{ID: 30, ProjectID: 10, PublicID: "story-public-id"},
		storyMessage: &storytellerModel.StoryChatMessage{ID: 77, Content: "原始訊息內容"},
	}

	result, err := storyChatMessageReferenceContent(repo, 20, "project-public-id", "story-public-id", 77)

	require.NoError(t, err)
	require.Equal(t, "原始訊息內容", result.Content)
	require.Equal(t, uint64(20), repo.storyMessageLookup.userID)
	require.Equal(t, uint64(30), repo.storyMessageLookup.storyID)
	require.Equal(t, uint64(77), repo.storyMessageLookup.messageID)
}

func TestAgentProposalReferenceContentUsesUserProjectScopedLookup(t *testing.T) {
	repo := &fakeAgentRunRepository{
		project: &storytellerModel.Project{ID: 10, UserID: 20, PublicID: "project-public-id"},
		projectProposal: &storytellerModel.AgentProposal{
			PublicID:  "proposal-public-id",
			ToolName:  "storyteller_upsert_lore",
			Arguments: `{"lore_public_id":"lore-public-id","content":"設定內容"}`,
		},
	}

	result, err := agentProposalReferenceContent(repo, 20, "project-public-id", "proposal-public-id")

	require.NoError(t, err)
	require.Contains(t, result.Content, "storyteller_upsert_lore")
	require.Contains(t, result.Content, "設定內容")
	require.Equal(t, uint64(20), repo.projectProposalLookup.userID)
	require.Equal(t, uint64(10), repo.projectProposalLookup.projectID)
	require.Equal(t, "proposal-public-id", repo.projectProposalLookup.publicID)
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

type contextCheckingAIProvider struct {
	onGenerate func(ctx context.Context, req AIProviderRequest) (*AIProviderResponse, error)
}

func (p *contextCheckingAIProvider) Generate(ctx context.Context, req AIProviderRequest) (*AIProviderResponse, error) {
	return p.onGenerate(ctx, req)
}
