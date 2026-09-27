package storyteller

import (
	"context"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

// completeAgenticQuery 是背景 goroutine 實際呼叫 provider、把結果補進 chat 的部分。
// 呼叫失敗時把 chat 退回 pending 讓使用者知道「沒拿到回覆」，不會讓 chat 卡在 in_progress。
func completeAgenticQuery(ctx context.Context, repo agentRunRepository, plan *agentRunPlan, tools []ToolSpec, writeToolNames map[string]bool, chatID uint64, requestXML string) (*storytellerModel.AgentRunUsage, error) {
	userID := plan.UserID
	// 工具 Handler 靠 context 辨識使用者與來源，不是走參數傳遞。
	ctx = WithStorytellerUserID(ctx, userID)
	ctx = WithStorytellerSource(ctx, "agentic_query")
	loopResult, loopErr := RunAgentLoop(ctx, AgentLoopRequest{
		Provider: plan.Provider, APIKey: plan.APIKey, ModelName: plan.ModelName,
		SystemPrompt: agentSystemPrompt(agentToolsProposeWrites), UserPrompt: requestXML, Tools: tools,
	})
	// RunAgentLoop 中止時仍可能帶回已用 token，要照常落地 usage 與稽核。
	if loopResult == nil {
		_ = repo.ReleaseChatToPending(chatID)
		return nil, loopErr
	}
	auditUsage := agentAuditUsage(loopResult.Usage)
	response := parseSuosuoResponse(loopResult.FinalText)
	output := &AgenticQueryOutput{
		RawResponses: loopResult.RawResponses, Provider: plan.Key.Provider, ModelName: plan.ModelName,
		Result: response.Answer, Expression: response.Expression, Steps: loopResult.Steps,
		Proposals: buildAgentProposalRows(ExtractProposals(loopResult, writeToolNames)), Usage: loopResult.Usage,
	}
	usage := buildAgenticQueryUsageLog(repo, userID, plan.Key.ID, output)
	if err := repo.CompleteChatMessage(chatID, agenticQueryAssistantMessage(output), output.Proposals, usage); err != nil {
		_ = repo.ReleaseChatToPending(chatID)
		return auditUsage, err
	}
	return auditUsage, loopErr
}

// completeAgentRun 對稱於 completeAgenticQuery：呼叫失敗時把 chat 退回 pending。
func completeAgentRun(ctx context.Context, repo agentRunRepository, plan *agentRunPlan, readOnlyTools []ToolSpec, useLoop bool, requestXML string, chatID uint64) (*storytellerModel.AgentRunUsage, error) {
	userID, tools := plan.UserID, agentToolsNone
	if useLoop {
		tools = agentToolsReadOnly
	}
	result, err := executeAgentRun(ctx, plan.Provider, plan.APIKey, plan.ModelName, agentSystemPrompt(tools), requestXML, plan.ProjectPublicID, readOnlyTools, useLoop, userID)
	if err != nil {
		_ = repo.ReleaseChatToPending(chatID)
		return nil, err
	}
	output := &storytellerModel.AgentRunResult{
		Provider: plan.Key.Provider, ModelName: plan.ModelName, Result: result.Text,
		Expression: string(result.Expression), FinishReason: result.FinishReason,
	}
	if result.Usage != nil {
		output.Usage = &storytellerModel.AgentRunUsage{
			InputTokens: result.Usage.InputTokens, OutputTokens: result.Usage.OutputTokens, TotalTokens: result.Usage.TotalTokens,
		}
	}
	usage := buildAgentUsageLog(repo, userID, plan.Key.ID, output)
	if err := repo.CompleteChatMessage(chatID, agentRunAssistantMessage(output, result.RawResponses), nil, usage); err != nil {
		_ = repo.ReleaseChatToPending(chatID)
		return output.Usage, err
	}
	return output.Usage, nil
}
