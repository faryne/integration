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

func TestAgenticQueryOutputMetadataUsage(t *testing.T) {
	withUsage := agenticQueryOutputMetadata(&AgenticQueryOutput{
		Steps: []AgentLoopStep{{
			ToolCalls: []ToolCall{{ID: "toolu_1", Name: "storyteller_get_story"}},
		}},
		Usage: &AIProviderUsage{InputTokens: 5, OutputTokens: 3, TotalTokens: 8},
	})
	require.JSONEq(t, `{"mode":"agentic_query","step_count":1,"steps":[{"tool_calls":[{"id":"toolu_1","name":"storyteller_get_story","arguments":null}],"results":[]}],"usage":{"input_tokens":5,"output_tokens":3,"total_tokens":8}}`, withUsage)

	withoutUsage := agenticQueryOutputMetadata(&AgenticQueryOutput{})
	var metadata map[string]interface{}
	require.NoError(t, json.Unmarshal([]byte(withoutUsage), &metadata))
	require.NotContains(t, metadata, "usage")
}

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

func TestAgenticQueryHistoriesSkipsIncompleteChats(t *testing.T) {
	rows := []storytellerModel.StoryChatMessage{
		{ID: 1, ChatID: 10, Role: storytellerModel.ChatMessageRoleUser, Content: "上一輪需求"},
		{ID: 2, ChatID: 10, Role: storytellerModel.ChatMessageRoleAssistant, Content: "上一輪回答"},
		// 沒拿到回覆的 chat（assistant 內容為空）整組略過。
		{ID: 5, ChatID: 12, Role: storytellerModel.ChatMessageRoleUser, Content: "孤兒問題"},
		{ID: 6, ChatID: 12, Role: storytellerModel.ChatMessageRoleAssistant, Content: ""},
	}

	require.Equal(t, []agentHistory{
		{Role: "user", Content: "上一輪需求"},
		{Role: "assistant", Content: "上一輪回答"},
	}, agenticQueryHistories(rows))
}

func TestRunStoryAgenticQueryRendersHistoryIntoRequest(t *testing.T) {
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
		historyMessages: []storytellerModel.StoryChatMessage{
			{ID: 1, ChatID: 10, Role: storytellerModel.ChatMessageRoleUser, Content: "把前段改寫"},
			{ID: 2, ChatID: 10, Role: storytellerModel.ChatMessageRoleAssistant, Content: "臣聞前段"},
		},
	}
	provider := &fakeSequentialAIProvider{
		onGenerate: func(req AIProviderRequest) (*AIProviderResponse, error) {
			// 歷史整組渲染進單一 <Request>，不再是原生多輪 messages。
			require.Len(t, req.Messages, 1)
			require.Contains(t, req.Messages[0].Content, "<History role=\"user\">把前段改寫</History>")
			require.Contains(t, req.Messages[0].Content, "<History role=\"assistant\">臣聞前段</History>")
			require.Contains(t, req.SystemPrompt, "do not imitate the voice of earlier assistant answers")
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

	// 全部動作都是非同步：撞到步數上限的錯誤只會在背景 log，不會回給呼叫端；
	// 就算失控被中止，也要把已經燒掉的 usage 記下來，不能整批丟掉。
	require.NoError(t, err)
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
	expectedReply := "<Reply>\n" + replyContent + "\n</Reply>"
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
	require.Contains(t, initialPrompt, expectedReply)
	require.Contains(t, initialPrompt, "<Task>\n"+userPrompt+"\n</Task>")
	require.Contains(t, repo.messages[0].Metadata, `"request_xml"`)
	require.Equal(t, uint64(1001), output.UserMessageID)
	require.Equal(t, uint64(1002), output.AssistantMessageID)
	// 回覆內容只存參照（不再有舊的 reply_content 快照欄位）；完整內容只會出現在 request_xml
	// 的 <Reply> 裡（那份是「實際送出的 request」快照，見 agentUserMessageMetadata）。
	require.NotContains(t, repo.messages[0].Metadata, "reply_content")
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
	// 重送從原始欄位（content／reply 參照）重新渲染，沒有歷史時內容必須跟第一次一致。
	require.Equal(t, initialPrompt, resendPrompt)
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
	expectedReply := "<Reply>\n" + replyContent + "\n</Reply>"
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
	require.Contains(t, initialPrompt, expectedReply)
	require.Contains(t, initialPrompt, "<Task>\n"+userPrompt+"\n</Task>")
	require.Contains(t, repo.messages[0].Metadata, `"request_xml"`)
	require.NotContains(t, repo.messages[0].Metadata, "reply_content")
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
	// 重送從原始欄位（content／reply 參照）重新渲染，沒有歷史時內容必須跟第一次一致。
	require.Equal(t, initialPrompt, resendPrompt)
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

// 沒有「目前選中的 Agent」：請求沒帶 persona_agent_id 就不能有 <Persona>，就算使用者有建立
// 帶 DefaultPrompt 的 Agent；明確帶了才套用。
func TestSubmitAppliesPersonaOnlyWhenRequestNamesIt(t *testing.T) {
	providerAPIKeyID := uint64(50)
	newRepo := func() *fakeAgentRunRepository {
		return &fakeAgentRunRepository{
			project:        &storytellerModel.Project{ID: 10, UserID: 20, PublicID: "project-public-id"},
			story:          &storytellerModel.Story{ID: 30, ProjectID: 10, PublicID: "story-public-id"},
			agent:          &storytellerModel.Agent{ID: 40, UserID: 20, Name: "色文作家", DefaultPrompt: "Be lewd.", ModelName: "claude-test", ProviderAPIKeyID: &providerAPIKeyID},
			providerAPIKey: encryptedTestProviderAPIKey(t, 50, 20, storytellerModel.AgentProviderClaude, "secret-key"),
		}
	}
	var sent string
	factory := func(storytellerModel.AgentProvider, string) (AIProvider, error) {
		return &fakeSequentialAIProvider{onGenerate: func(req AIProviderRequest) (*AIProviderResponse, error) {
			sent = req.Messages[0].Content
			return &AIProviderResponse{Result: "ok"}, nil
		}}, nil
	}

	_, err := runStoryAgenticQuery(context.Background(), newRepo(), factory, nil, nil, 20, "project-public-id", "story-public-id", 0, "普通問題", AgenticQueryOptions{})
	require.NoError(t, err)
	require.NotContains(t, sent, "<Persona")

	_, err = runStoryAgenticQuery(context.Background(), newRepo(), factory, nil, nil, 20, "project-public-id", "story-public-id", 40, "普通問題", AgenticQueryOptions{})
	require.NoError(t, err)
	require.Contains(t, sent, "<Persona name=\"色文作家\">\nBe lewd.\n</Persona>")
}

// key／model 是這次呼叫的明確選擇，沒有 Agent 記錄上的預設值可以退回。
func TestSubmitRequiresProviderAPIKeyAndModel(t *testing.T) {
	repo := &fakeAgentRunRepository{
		project: &storytellerModel.Project{ID: 10, UserID: 20, PublicID: "project-public-id"},
		story:   &storytellerModel.Story{ID: 30, ProjectID: 10, PublicID: "story-public-id"},
	}
	_, err := submitAgenticQuery(testSubmitDeps(repo, background.NewTracker(), nil, nil, nil), 20, "project-public-id", agenticQueryCurrentTargetStory, "story-public-id", "問題", AgenticQueryOptions{})
	require.ErrorIs(t, err, errProviderAPIKeyRequired)
	require.Nil(t, repo.chat)
}
