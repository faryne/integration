package storyteller

import (
	"context"
	"encoding/json"
	"strings"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

// AgenticQueryOutput 是 RunStoryAgenticQuery 的回傳結果。
type AgenticQueryOutput struct {
	AgentID   uint64
	Provider  storytellerModel.AgentProvider
	ModelName string
	Result    string
	// Steps 是 agent 這輪對話呼叫過哪些工具、各自結果——之後 Phase 6 前端要顯示
	// 「正在呼叫哪個工具」的過程提示，直接讀這份資料即可。
	Steps []AgentLoopStep
	Usage *AIProviderUsage
}

// RunStoryAgenticQuery 是 Phase 4 把 Phase 3 雛型收斂成的第一個正式可呼叫功能：
// 在故事編輯頁的 AI Agent 對話裡，讓 agent 可以自己讀這個 project 底下的故事／
// 設定集／資產再回答，不是只能看呼叫端主動塞進 prompt 裡的內容（對照既有的
// RunAgent／RunLoreAgent：那組是單輪、無工具呼叫能力的「改寫/擴寫/翻譯」skill
// 式功能，這個是多輪、會自己查資料的問答功能，兩者刻意分開、互不影響）。
//
// 這輪刻意只開放唯讀工具（ReadOnlyStorytellerTools），並用 ScopeToolsToProject
// 把每個工具呼叫都鎖在 projectPublicID 底下：Phase 5 的「提案 -> diff -> 確認 ->
// revert」寫入安全機制還沒做，在那之前讓 agent 能自主呼叫寫入/刪除工具是不負責任
// 的，等 Phase 5 做完再開放寫入工具給這個入口。
func (s *Service) RunStoryAgenticQuery(ctx context.Context, userID uint64, projectPublicID, storyPublicID string, agentID uint64, userPrompt string) (*AgenticQueryOutput, error) {
	tools := ScopeToolsToProject(ReadOnlyStorytellerTools(), projectPublicID)
	return runStoryAgenticQuery(ctx, s.repo, NewAIProvider, tools, userID, projectPublicID, storyPublicID, agentID, userPrompt)
}

// runStoryAgenticQuery 是 RunStoryAgenticQuery 拆出來、可注入 repo／provider
// factory／tools 的版本，比照既有 runAgent 的測試模式（agentRunRepository 這個
// interface 已經涵蓋這裡需要的全部 5 個方法，不用另外定義一個新 interface）。
func runStoryAgenticQuery(ctx context.Context, repo agentRunRepository, providerFactory aiProviderFactory, tools []ToolSpec, userID uint64, projectPublicID, storyPublicID string, agentID uint64, userPrompt string) (*AgenticQueryOutput, error) {
	if strings.TrimSpace(userPrompt) == "" {
		return nil, errAgenticQueryEmptyPrompt
	}
	project, err := repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	story, err := repo.Story(project.ID, storyPublicID)
	if err != nil {
		return nil, err
	}
	agent, err := repo.Agent(userID, agentID)
	if err != nil {
		return nil, err
	}
	providerAPIKeyRow, err := resolveAgentProviderAPIKey(repo.ProviderAPIKey, userID, agent, nil)
	if err != nil {
		return nil, err
	}
	provider, err := providerFactory(agent.Provider, providerAPIKeyRow.Endpoint)
	if err != nil {
		return nil, err
	}
	apiKey, err := decryptProviderAPIKey(providerAPIKeyRow)
	if err != nil {
		return nil, err
	}

	// 這組工具的 Handler（storyteller_get_story 等）內部都是靠
	// storytellerUserIDFromContext／storytellerSourceFromContext 從 ctx 拿身分，
	// 不是走參數傳遞（MCP 那層也是同樣的機制，見 tool_registry_context.go）——
	// 這裡呼叫的是同一份底層工具邏輯，一定要先把身分塞進 ctx，不然每個工具呼叫
	// 都會因為 storytellerUserIDFromContext 拿不到值而失敗。
	ctx = WithStorytellerUserID(ctx, userID)
	ctx = WithStorytellerSource(ctx, "agentic_query")

	loopResult, loopErr := RunAgentLoop(ctx, AgentLoopRequest{
		Provider:     provider,
		APIKey:       apiKey,
		ModelName:    agent.ModelName,
		SystemPrompt: agenticQuerySystemPrompt(*agent, projectPublicID),
		UserPrompt:   userPrompt,
		Tools:        tools,
	})
	// loopResult 就算在 loopErr 非 nil 時（例如撞到步數上限）也可能有值——
	// RunAgentLoop 刻意在中止時仍回傳累積到目前為止的 Steps/Usage，這裡照樣把
	// 這些資訊記進 usage log／chat 歷史，不能因為沒拿到最終答案就整批丟掉已經
	// 發生、已經花錢的呼叫紀錄；只有 loopResult 真的是 nil（一開始就失敗，例如
	// API key 無效）才整個放棄。
	if loopResult == nil {
		return nil, loopErr
	}

	output := &AgenticQueryOutput{
		AgentID:   agent.ID,
		Provider:  agent.Provider,
		ModelName: agent.ModelName,
		Result:    loopResult.FinalText,
		Steps:     loopResult.Steps,
		Usage:     loopResult.Usage,
	}
	chat, messages := buildAgenticQueryChat(userID, story.ID, *agent, userPrompt, output)
	usage := buildAgenticQueryUsageLog(userID, providerAPIKeyRow.ID, *agent, output)
	if err := repo.CreateStoryChatWithMessages(chat, messages, usage); err != nil {
		return nil, err
	}
	if loopErr != nil {
		return output, loopErr
	}
	return output, nil
}

var errAgenticQueryEmptyPrompt = agenticQueryError("user_prompt is required")

type agenticQueryError string

func (e agenticQueryError) Error() string { return string(e) }

func agenticQuerySystemPrompt(agent storytellerModel.Agent, projectPublicID string) string {
	base := strings.TrimSpace(`You are Storyteller's writing assistant, running in agentic mode: you can call
read-only tools (storyteller_get_*, storyteller_list_*) to look up the user's stories, lore/worldbuilding
entries, and assets before answering, instead of only seeing what's pasted into this conversation.

Rules:
- Follow the purpose, tone, and constraints configured for this Agent.
- Only call tools when you actually need information you don't already have; don't call a tool "just in
  case" if the user's question doesn't require it.
- Every tool call must use the project_public_id given below — you have no access to any other project.
- If a tool call fails or returns unexpected data, explain what you tried and continue with the best answer
  you can give, don't just give up silently.
- Answer in the language the user wrote in.`)
	instructions := strings.TrimSpace(agent.DefaultPrompt)
	if instructions != "" {
		base = base + "\n\nAgent-specific instructions:\n" + instructions
	}
	return base + "\n\nAuthorized project_public_id for this conversation: " + projectPublicID
}

func buildAgenticQueryChat(userID, storyID uint64, agent storytellerModel.Agent, userPrompt string, output *AgenticQueryOutput) (*storytellerModel.StoryChat, []storytellerModel.StoryChatMessage) {
	chat := &storytellerModel.StoryChat{
		StoryID: &storyID,
		AgentID: agent.ID,
		UserID:  userID,
	}
	messages := []storytellerModel.StoryChatMessage{
		{
			AgentID: &agent.ID,
			Role:    storytellerModel.ChatMessageRoleUser,
			Content: userPrompt,
		},
		{
			AgentID:  &agent.ID,
			Role:     storytellerModel.ChatMessageRoleAssistant,
			Content:  output.Result,
			Metadata: agenticQueryOutputMetadata(output),
		},
	}
	return chat, messages
}

// agenticQueryOutputMetadata 把這輪呼叫過的工具記成 JSON，存進既有 StoryChatMessage
// 的 Metadata 欄位（沿用 agentRunOutputMetadata 的既有慣例）。這個 repo 的
// ChatMessageRole 目前只有 system/user/assistant 三種，沒有獨立的 "tool" 角色，
// 要幫這個加一個新角色是 DB schema 異動，這輪刻意不做（範圍控制）——多輪工具呼叫
// 的完整過程改用這個 metadata JSON 壓縮記錄，不逐則存成獨立訊息列。
func agenticQueryOutputMetadata(output *AgenticQueryOutput) string {
	type toolCallLogEntry struct {
		Name  string `json:"name"`
		Error string `json:"error,omitempty"`
	}
	type queryMetadata struct {
		Mode      string             `json:"mode"`
		StepCount int                `json:"step_count"`
		ToolCalls []toolCallLogEntry `json:"tool_calls,omitempty"`
	}
	meta := queryMetadata{Mode: "agentic_query", StepCount: len(output.Steps)}
	for _, step := range output.Steps {
		for i, call := range step.ToolCalls {
			entry := toolCallLogEntry{Name: call.Name}
			if i < len(step.Results) && step.Results[i].Err != nil {
				entry.Error = step.Results[i].Err.Error()
			}
			meta.ToolCalls = append(meta.ToolCalls, entry)
		}
	}
	body, err := json.Marshal(meta)
	if err != nil {
		return ""
	}
	return string(body)
}

// buildAgenticQueryUsageLog 沿用既有 buildAgentUsageLog 的欄位慣例，差別只在
// usage 來源是 AgentLoopResult 累加過的多輪用量，不是單一次 provider 呼叫。
func buildAgenticQueryUsageLog(userID, providerAPIKeyID uint64, agent storytellerModel.Agent, output *AgenticQueryOutput) *storytellerModel.AgentUsageLog {
	if output == nil || output.Usage == nil {
		return nil
	}
	return &storytellerModel.AgentUsageLog{
		UserID:           userID,
		ProviderAPIKeyID: providerAPIKeyID,
		AgentID:          agent.ID,
		Provider:         agent.Provider,
		ModelName:        agent.ModelName,
		InputTokens:      output.Usage.InputTokens,
		OutputTokens:     output.Usage.OutputTokens,
		TotalTokens:      output.Usage.TotalTokens,
	}
}
