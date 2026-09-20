package storyteller

import (
	"context"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/service/background"
)

// 這幾個 helper 讓既有測試沿用舊的呼叫形狀，但底下一律走單一非同步 pipeline
// （submitAgentRun）：送出後等 tracker 跑完背景工作，再從 repo 的落地結果組出 output。

func testSubmitDeps(repo agentRunRepository, work agenticBackgroundWork, factory aiProviderFactory, tools []ToolSpec, writeToolNames map[string]bool) agentSubmitDeps {
	return agentSubmitDeps{
		Repo: repo, Work: work, ProviderFactory: factory,
		AgenticTools: func(string) ([]ToolSpec, map[string]bool) { return tools, writeToolNames },
	}
}

// 送出時 key／model 是必填的請求欄位；既有測試沒特別指定時在這裡代填預設值，
// 並把測試裡的 agentID 當作「明確指定的自建 skill（persona）」。
func withTestKeyDefaults(_ agentRunRepository, keyID **uint64, modelName *string) {
	if *keyID == nil {
		id := uint64(50)
		*keyID = &id
	}
	if *modelName == "" {
		*modelName = "test-model"
	}
}

func enqueueStoryAgenticQuery(_ context.Context, repo agentRunRepository, work agenticBackgroundWork, factory aiProviderFactory, tools []ToolSpec, writeToolNames map[string]bool, userID uint64, projectPublicID, storyPublicID string, agentID uint64, userPrompt string, opts AgenticQueryOptions) (*AgenticQueryOutput, error) {
	withTestKeyDefaults(repo, &opts.ProviderAPIKeyID, &opts.ModelName)
	if agentID != 0 {
		opts.PersonaAgentID = &agentID
	}
	return submitAgenticQuery(testSubmitDeps(repo, work, factory, tools, writeToolNames), userID, projectPublicID, agenticQueryCurrentTargetStory, storyPublicID, userPrompt, opts)
}

// runStoryAgenticQuery 送出後等背景跑完，再從 repo 落地的訊息／usage 還原結果。
func runStoryAgenticQuery(ctx context.Context, repo *fakeAgentRunRepository, factory aiProviderFactory, tools []ToolSpec, writeToolNames map[string]bool, userID uint64, projectPublicID, storyPublicID string, agentID uint64, userPrompt string, opts AgenticQueryOptions) (*AgenticQueryOutput, error) {
	tracker := background.NewTracker()
	output, err := enqueueStoryAgenticQuery(ctx, repo, tracker, factory, tools, writeToolNames, userID, projectPublicID, storyPublicID, agentID, userPrompt, opts)
	if err != nil {
		return nil, err
	}
	tracker.BeginDrain()
	tracker.Wait()
	return completedOutputFromRepo(repo, output), nil
}

func resendStoryAgenticQuery(_ context.Context, repo *fakeAgentRunRepository, factory aiProviderFactory, tools []ToolSpec, writeToolNames map[string]bool, userID uint64, projectPublicID, storyPublicID string, agentID, chatID uint64, opts AgenticQueryOptions) (*AgenticQueryOutput, error) {
	withTestKeyDefaults(repo, &opts.ProviderAPIKeyID, &opts.ModelName)
	tracker := background.NewTracker()
	output, err := resubmitAgenticQuery(testSubmitDeps(repo, tracker, factory, tools, writeToolNames), userID, projectPublicID, agenticQueryCurrentTargetStory, storyPublicID, chatID, opts)
	if err != nil {
		return nil, err
	}
	tracker.BeginDrain()
	tracker.Wait()
	return completedOutputFromRepo(repo, output), nil
}

func completedOutputFromRepo(repo *fakeAgentRunRepository, ack *AgenticQueryOutput) *AgenticQueryOutput {
	out := *ack
	if n := len(repo.messages); n > 0 && repo.messages[n-1].Role == storytellerModel.ChatMessageRoleAssistant {
		out.Result = repo.messages[n-1].Content
		out.AssistantMessageID = repo.messages[n-1].ID
		out.ChatStatus = storytellerModel.StoryChatStatusCompleted
	}
	if repo.usage != nil {
		out.Usage = &AIProviderUsage{InputTokens: repo.usage.InputTokens, OutputTokens: repo.usage.OutputTokens, TotalTokens: repo.usage.TotalTokens}
	}
	return &out
}

func runAgent(_ context.Context, repo agentRunRepository, factory aiProviderFactory, work agenticBackgroundWork, userID uint64, projectPublicID, storyPublicID string, agentID uint64, input storytellerModel.AgentRunRequest) (*AgenticQueryOutput, error) {
	return runAgentWithTools(context.Background(), repo, factory, nil, work, userID, projectPublicID, storyPublicID, agentID, input)
}

func runAgentWithTools(_ context.Context, repo agentRunRepository, factory aiProviderFactory, readOnlyTools []ToolSpec, work agenticBackgroundWork, userID uint64, projectPublicID, storyPublicID string, agentID uint64, input storytellerModel.AgentRunRequest) (*AgenticQueryOutput, error) {
	withTestKeyDefaults(repo, &input.ProviderAPIKeyID, &input.ModelName)
	if agentID != 0 {
		input.PersonaAgentID = &agentID
	}
	return submitAgentSkill(testSubmitDeps(repo, work, factory, nil, nil), readOnlyTools, userID, projectPublicID, agenticQueryCurrentTargetStory, storyPublicID, input)
}
