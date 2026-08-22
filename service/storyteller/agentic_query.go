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
	// Proposals 是這輪對話裡 agent 想呼叫、但被攔下來、還沒真的執行的寫入類工具
	// 呼叫（見 CaptureWriteToolsAsProposals）。前端要把某個 Proposal 的
	// ToolName／Arguments 原樣送回 ApplyAgentProposal 才會真的落地；使用者不理會
	// 的提案就讓它留在這輪對話歷史裡，不會自動生效、也不會過期需要清理。
	Proposals []AgentProposal
	Usage     *AIProviderUsage
}

// ToResponse 把內部表示轉成 HTTP 回應用的 DTO（model/entity/storyteller 那份），
// 讓 controller 不用自己重新攤平這幾層巢狀結構，也讓「內部資料形狀」跟「API 回應
// 格式」保持獨立，之後要調整內部實作不會直接牽動到 wire format。
func (o *AgenticQueryOutput) ToResponse() storytellerModel.AgenticQueryResponse {
	steps := make([]storytellerModel.AgenticStepOutput, 0, len(o.Steps))
	for _, step := range o.Steps {
		calls := make([]storytellerModel.AgenticToolCallOutput, 0, len(step.ToolCalls))
		for _, call := range step.ToolCalls {
			calls = append(calls, storytellerModel.AgenticToolCallOutput{
				ID:        call.ID,
				Name:      call.Name,
				Arguments: call.Arguments,
			})
		}
		results := make([]storytellerModel.AgenticToolResultOutput, 0, len(step.Results))
		for _, result := range step.Results {
			out := storytellerModel.AgenticToolResultOutput{Content: result.Content}
			if result.Err != nil {
				out.Error = result.Err.Error()
			}
			results = append(results, out)
		}
		steps = append(steps, storytellerModel.AgenticStepOutput{ToolCalls: calls, Results: results})
	}

	proposals := make([]storytellerModel.AgenticProposalOutput, 0, len(o.Proposals))
	for _, p := range o.Proposals {
		proposals = append(proposals, storytellerModel.AgenticProposalOutput{
			ToolCallID: p.ToolCallID,
			ToolName:   p.ToolName,
			Arguments:  p.Arguments,
		})
	}

	var usage *storytellerModel.AgentRunUsage
	if o.Usage != nil {
		usage = &storytellerModel.AgentRunUsage{
			InputTokens:  o.Usage.InputTokens,
			OutputTokens: o.Usage.OutputTokens,
			TotalTokens:  o.Usage.TotalTokens,
		}
	}

	return storytellerModel.AgenticQueryResponse{
		AgentID:   o.AgentID,
		Provider:  o.Provider,
		ModelName: o.ModelName,
		Result:    o.Result,
		Steps:     steps,
		Proposals: proposals,
		Usage:     usage,
	}
}

// AgenticQueryOptions 是這次呼叫要不要覆寫 Agent 預設 provider/key/model 的選項，
// 兩者互相獨立、都可以留空沿用 Agent 的預設值。這是「Agent 只是人設/prompt，
// 用哪把 key／哪個 model 是每次呼叫當下的選擇」這個方向的落地：聊天視窗要做 key
// 切換功能時，把使用者選的 key id（可能連 provider 都跟 Agent 預設的不一樣）帶
// 進 ProviderAPIKeyID 即可，不需要因此複製一份 Agent。
type AgenticQueryOptions struct {
	ProviderAPIKeyID *uint64
	ModelName        string
}

// RunStoryAgenticQuery 是 Phase 4 把 Phase 3 雛型收斂成的第一個正式可呼叫功能：
// 在故事編輯頁的 AI Agent 對話裡，讓 agent 可以自己讀這個 project 底下的故事／
// 設定集／資產再回答，不是只能看呼叫端主動塞進 prompt 裡的內容（對照既有的
// RunAgent／RunLoreAgent：那組是單輪、無工具呼叫能力的「改寫/擴寫/翻譯」skill
// 式功能，這個是多輪、會自己查資料的問答功能，兩者刻意分開、互不影響）。
//
// Phase 5 起，寫入類工具也會被列進去（透過 CaptureWriteToolsAsProposals 包一層，
// 呼叫時不會真的執行，只會被記錄成 Proposals），讓 agent 可以規劃「應該怎麼改」，
// 但實際落地一定要等使用者呼叫 ApplyAgentProposal 明確確認——ScopeToolsToProject
// 仍然把每個工具呼叫（不管唯讀還是寫入提案）都鎖在 projectPublicID 底下。
func (s *Service) RunStoryAgenticQuery(ctx context.Context, userID uint64, projectPublicID, storyPublicID string, agentID uint64, userPrompt string, opts AgenticQueryOptions) (*AgenticQueryOutput, error) {
	writeToolNames := WriteStorytellerToolNames()
	tools := StorytellerToolRegistry().All()
	tools = CaptureWriteToolsAsProposals(tools, writeToolNames)
	tools = ScopeToolsToProject(tools, projectPublicID)
	return runStoryAgenticQuery(ctx, s.repo, NewAIProvider, tools, writeToolNames, userID, projectPublicID, storyPublicID, agentID, userPrompt, opts)
}

// runStoryAgenticQuery 是 RunStoryAgenticQuery 拆出來、可注入 repo／provider
// factory／tools 的版本，比照既有 runAgent 的測試模式（agentRunRepository 這個
// interface 已經涵蓋這裡需要的全部 5 個方法，不用另外定義一個新 interface）。
func runStoryAgenticQuery(ctx context.Context, repo agentRunRepository, providerFactory aiProviderFactory, tools []ToolSpec, writeToolNames map[string]bool, userID uint64, projectPublicID, storyPublicID string, agentID uint64, userPrompt string, opts AgenticQueryOptions) (*AgenticQueryOutput, error) {
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
	providerAPIKeyRow, err := resolveAgentProviderAPIKey(repo.ProviderAPIKey, userID, agent, opts.ProviderAPIKeyID)
	if err != nil {
		return nil, err
	}
	// provider／modelName 用「這次實際解析出來的」，不是 Agent 記錄的靜態預設——
	// Agent 只保留人設/prompt，key／model 各自獨立覆寫，可能連 provider 都跟
	// Agent 原本設定的不一樣（見 resolveAgentProviderAPIKey 的說明）。
	modelName := resolveAgentModelName(agent, opts.ModelName)
	provider, err := providerFactory(providerAPIKeyRow.Provider, providerAPIKeyRow.Endpoint)
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
		ModelName:    modelName,
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
		Provider:  providerAPIKeyRow.Provider,
		ModelName: modelName,
		Result:    loopResult.FinalText,
		Steps:     loopResult.Steps,
		Proposals: ExtractProposals(loopResult, writeToolNames),
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
entries, and assets before answering, instead of only seeing what's pasted into this conversation. You can
also call write tools (e.g. storyteller_upsert_story, storyteller_delete_story, storyteller_revert_story) to
propose a change — but these calls do NOT take effect immediately. Each write call is intercepted and recorded
as a pending proposal for the user to review and explicitly confirm; you will get back a message saying so,
not a confirmation that the change happened.

Rules:
- Follow the purpose, tone, and constraints configured for this Agent.
- Only call tools when you actually need information you don't already have, or when the user is asking you
  to make a concrete change; don't call a tool "just in case" if it isn't needed.
- Every tool call must use the project_public_id given below — you have no access to any other project.
- When proposing a write, pass the FULL intended final state as the tool arguments (e.g. for
  storyteller_upsert_story, include the complete updated content, not just a diff or a description of the
  change) — the user will see exactly what you pass as the proposed new state.
- After proposing one or more writes, tell the user in your final answer what you've prepared for them to
  review; never claim a write has already been applied.
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
	type proposalLogEntry struct {
		ToolCallID string                 `json:"tool_call_id"`
		ToolName   string                 `json:"tool_name"`
		Arguments  map[string]interface{} `json:"arguments"`
	}
	type queryMetadata struct {
		Mode      string             `json:"mode"`
		StepCount int                `json:"step_count"`
		ToolCalls []toolCallLogEntry `json:"tool_calls,omitempty"`
		// Proposals 存下來讓聊天歷史重新載入時，前端還看得到這輪對話當初提出過
		// 哪些待確認的寫入提案（不代表還沒被套用或還沒過期，前端要自己比對這篇
		// 故事/設定集目前的版本判斷這個提案是否還有意義）。
		Proposals []proposalLogEntry `json:"proposals,omitempty"`
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
	for _, proposal := range output.Proposals {
		meta.Proposals = append(meta.Proposals, proposalLogEntry{
			ToolCallID: proposal.ToolCallID,
			ToolName:   proposal.ToolName,
			Arguments:  proposal.Arguments,
		})
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
		// Provider／ModelName 用這次「實際」解析出來的（output 已經套用過
		// key／model 覆寫），不是 Agent 記錄的靜態預設。
		Provider:     output.Provider,
		ModelName:    output.ModelName,
		InputTokens:  output.Usage.InputTokens,
		OutputTokens: output.Usage.OutputTokens,
		TotalTokens:  output.Usage.TotalTokens,
	}
}
