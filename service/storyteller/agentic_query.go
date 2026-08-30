package storyteller

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

// AgenticQueryOutput 是 RunStoryAgenticQuery 的回傳結果。
type AgenticQueryOutput struct {
	AgentID uint64
	// ChatID 是這輪對話存進 storyteller_story_chats 的那筆——不管最後有沒有拿到
	// 回覆都會帶回前端（見 runStoryAgenticQuery／resendStoryAgenticQuery 在
	// RunAgentLoop 失敗時也組一份只帶 ChatID 的 output），讓前端知道「這輪已經
	// 落地在哪個 chat」，用來：(1) 讓即時樂觀更新的泡泡也能顯示「重送」，不用
	// 等重新整理頁面；(2) 跟背景重新整理時抓回來的歷史紀錄用 chat_id 對齊去重，
	// 不會同一輪對話一邊顯示「還在生成」一邊顯示「沒拿到回覆」。
	ChatID uint64
	// 兩個 message id 是給前端 session 內的樂觀訊息換成 DB id 用；如果使用者
	// 立刻回覆剛產生的 assistant 訊息，新 metadata 才能只存 message id 參照。
	UserMessageID      uint64
	AssistantMessageID uint64
	// ChatStatus 反映 ChatID 這筆 chat 在 DB 裡的真實狀態——不能單看 Result／
	// Warning 猜：撞到步數上限時雖然有 Warning，但已經呼叫過 CompleteChatMessage
	// 存成 completed；一開始呼叫 provider 就失敗（loopResult 是 nil）則從沒呼叫
	// CompleteChatMessage，實際會退回 pending，之後可以重送。
	ChatStatus storytellerModel.StoryChatStatus
	Provider   storytellerModel.AgentProvider
	ModelName  string
	Result     string
	// Steps 是 agent 這輪對話呼叫過哪些工具、各自結果——之後 Phase 6 前端要顯示
	// 「正在呼叫哪個工具」的過程提示，直接讀這份資料即可。
	Steps []AgentLoopStep
	// Proposals 是這輪對話裡 agent 想呼叫、但被攔下來、還沒真的執行的寫入類工具
	// 呼叫（見 CaptureWriteToolsAsProposals）——已經是要存進 DB 的資料列形狀
	// （PublicID 在存檔前就先產生好，見 runStoryAgenticQuery），前端呼叫
	// POST .../agentic-proposals/:proposal/apply 或 /reject 時用 PublicID
	// 指名要動哪一筆；使用者不理會的提案就留在 pending，不會自動生效、也不會
	// 過期需要清理。
	Proposals []storytellerModel.AgentProposal
	Usage     *AIProviderUsage
	// RawResponses 是這輪對話每一次 provider.Generate() 呼叫收到的原始 response
	// body（見 AgentLoopResult.RawResponses 的說明），直接從 loopResult 帶過來，
	// 只用來組 agenticQueryAssistantMessage 的 RawProviderResponse 欄位，純除錯
	// 用途，不會經過 ToResponse() 流到 API 回應。
	RawResponses []string
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
		var arguments map[string]interface{}
		_ = json.Unmarshal([]byte(p.Arguments), &arguments)
		proposals = append(proposals, storytellerModel.AgenticProposalOutput{
			PublicID:   p.PublicID,
			ToolCallID: p.ToolCallID,
			ToolName:   p.ToolName,
			Arguments:  arguments,
			Status:     p.Status,
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
		AgentID:            o.AgentID,
		ChatID:             o.ChatID,
		UserMessageID:      o.UserMessageID,
		AssistantMessageID: o.AssistantMessageID,
		ChatStatus:         o.ChatStatus,
		Provider:           o.Provider,
		ModelName:          o.ModelName,
		Result:             o.Result,
		Steps:              steps,
		Proposals:          proposals,
		Usage:              usage,
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
	// IgnoreAgentPersona 見 storytellerModel.AgenticQueryRequest 的說明：true 時
	// system prompt 略過這個 Agent 的 DefaultPrompt，但 key／model／usage log／
	// chat 記錄仍然照常用這個 Agent。
	IgnoreAgentPersona bool
	// ReplyContent 是使用者按「回覆」時，被回覆那則訊息的完整內容（不是摘要）——
	// UserPrompt 裡已經帶了一行摘要引言方便人類跟模型定位「在回覆誰」，這裡才是
	// 真正讓模型讀到完整內容的管道。留空代表這次送出不是在回覆任何訊息。
	ReplyContent string
	// ReplyReference 只用來寫入這則 user message 的 metadata；送 provider 的
	// prompt 仍使用 ReplyContent，避免送出當下的行為被持久化格式改動影響。
	ReplyReference *storytellerModel.AgenticReplyReferenceRequest
}

const (
	// agenticQueryReplyContentMaxRunes 比照 skill 模式 full_content 的上限（見
	// agentRunFullContentMaxRunes），同樣是使用者可能整段貼進來的內容，用一樣的
	// 尺度防護。
	agenticQueryReplyContentMaxRunes = 60000
	// agenticQueryHistoryMessageLimit 是每次呼叫附帶的歷史訊息則數上限（一則使用者
	// +一則 AI 算兩則，這裡的 10 對應最近 5 輪對話）——只抓「最近幾輪」，不是整個
	// 對話串，避免對話變長後每輪呼叫的 token 成本跟著無上限累加、拖慢回應時間到
	// timeout。
	agenticQueryHistoryMessageLimit = 10
)

var errAgenticQueryReplyContentTooLong = agenticQueryError(fmt.Sprintf("reply_content must be %d characters or less", agenticQueryReplyContentMaxRunes))

// agenticQueryUserPromptWithReply 把回覆對象的完整內容接在 userPrompt 後面，格式
// 比照前端 buildStorytellerAgentReplyReferenceContent 已經在用的 fence 寫法，讓
// skill／agentic 兩條路徑餵給模型的格式一致。userPrompt 本身（見前端
// composeStorytellerAgentInstructionWithReply）已經帶了一行「> 回覆 XXX：摘要」
// 方便定位是在回覆誰，這裡不重複標 speaker，只補上摘要沒放完的完整內容。
func agenticQueryUserPromptWithReply(userPrompt, replyContent string) string {
	replyContent = strings.TrimSpace(replyContent)
	if replyContent == "" {
		return userPrompt
	}
	return userPrompt + "\n\nReference reply (full content of the message quoted above):\n<<<REPLY_REFERENCE_CONTENT\n" + replyContent + "\nREPLY_REFERENCE_CONTENT"
}

// agenticQueryHistoryMessages 把撈出來的歷史訊息列（見 RecentStoryAgenticMessages／
// RecentLoreAgenticMessages）轉成 provider 要的 Message 陣列——agentic_query 模式
// 每輪只會存 user／assistant 各一則（agenticQueryChatMessages），不會有 tool 角色
// 的列，不用另外處理工具呼叫中間態。
func agenticQueryHistoryMessages(rows []storytellerModel.StoryChatMessage) []Message {
	// 依 chat 分組：曾經跑到步數上限（ErrAgentLoopMaxStepsExceeded）或其他中途
	// 中止的舊紀錄，assistant 那則訊息的 content 可能是空字串——這種內容直接
	// 送給 provider 會被拒絕（Claude 的 content block 缺了必填的 text 欄位），
	// 而且 Claude API 要求 user/assistant 嚴格交替，不能只砍掉單則訊息、留下
	// 落單的另一則。乾脆整個 chat（一問一答）一起跳過，不把不完整的紀錄餵給
	// 模型，比只補一個空字串佔位更乾淨。
	byChat := make(map[uint64][]storytellerModel.StoryChatMessage, len(rows))
	order := make([]uint64, 0, len(rows))
	for _, row := range rows {
		if _, ok := byChat[row.ChatID]; !ok {
			order = append(order, row.ChatID)
		}
		byChat[row.ChatID] = append(byChat[row.ChatID], row)
	}
	messages := make([]Message, 0, len(rows))
	for _, chatID := range order {
		chatRows := byChat[chatID]
		complete := len(chatRows) == 2 &&
			chatRows[0].Role == storytellerModel.ChatMessageRoleUser &&
			chatRows[1].Role == storytellerModel.ChatMessageRoleAssistant
		for _, row := range chatRows {
			if strings.TrimSpace(row.Content) == "" {
				complete = false
				break
			}
		}
		if !complete {
			continue
		}
		for _, row := range chatRows {
			messages = append(messages, Message{Role: string(row.Role), Content: row.Content})
		}
	}
	return messages
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
	return runStoryAgenticQuery(ctx, s.repo, NewAgenticAIProvider, tools, writeToolNames, userID, projectPublicID, storyPublicID, agentID, userPrompt, opts)
}

// runStoryAgenticQuery 是 RunStoryAgenticQuery 拆出來、可注入 repo／provider
// factory／tools 的版本，比照既有 runAgent 的測試模式（agentRunRepository 這個
// interface 已經涵蓋這裡需要的全部 5 個方法，不用另外定義一個新 interface）。
func runStoryAgenticQuery(ctx context.Context, repo agentRunRepository, providerFactory aiProviderFactory, tools []ToolSpec, writeToolNames map[string]bool, userID uint64, projectPublicID, storyPublicID string, agentID uint64, userPrompt string, opts AgenticQueryOptions) (*AgenticQueryOutput, error) {
	if strings.TrimSpace(userPrompt) == "" {
		return nil, errAgenticQueryEmptyPrompt
	}
	if len([]rune(opts.ReplyContent)) > agenticQueryReplyContentMaxRunes {
		return nil, errAgenticQueryReplyContentTooLong
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
	if strings.TrimSpace(modelName) == "" {
		return nil, errAgentModelNameNotConfigured
	}
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

	historyRows, err := repo.RecentStoryAgenticMessages(story.ID, agenticQueryHistoryMessageLimit)
	if err != nil {
		return nil, err
	}

	// 送出當下先把使用者的問題落地（chat 進 in_progress），不等 provider 回應——這樣
	// 即使等下 RunAgentLoop 因為 timeout／process 被重啟而拿不到答案，使用者至少
	// 不會連自己問了什麼都找不到；之後可以用「重送」（見 resendStoryAgenticQuery）
	// 補完這輪，不用整句重打。
	chat, userMessage := buildPendingAgenticQueryChat(userID, story.ID, *agent, userPrompt, opts.ReplyReference, opts.IgnoreAgentPersona)
	if err := repo.CreateInProgressChatWithUserMessage(chat, userMessage); err != nil {
		return nil, err
	}

	loopResult, loopErr := RunAgentLoop(ctx, AgentLoopRequest{
		Provider:     provider,
		APIKey:       apiKey,
		ModelName:    modelName,
		SystemPrompt: agenticQuerySystemPrompt(*agent, projectPublicID, agenticQueryCurrentTargetStory, story.PublicID, story.Title, opts.IgnoreAgentPersona),
		History:      agenticQueryHistoryMessages(historyRows),
		UserPrompt:   agenticQueryUserPromptWithReply(userPrompt, opts.ReplyContent),
		Tools:        tools,
	})
	// loopResult 就算在 loopErr 非 nil 時（例如撞到步數上限）也可能有值——
	// RunAgentLoop 刻意在中止時仍回傳累積到目前為止的 Steps/Usage，這裡照樣把
	// 這些資訊記進 usage log／chat 歷史，不能因為沒拿到最終答案就整批丟掉已經
	// 發生、已經花錢的呼叫紀錄；只有 loopResult 真的是 nil（一開始就失敗，例如
	// API key 無效）才整個放棄——這種情況 chat 退回 pending，之後可以重送。
	// 就算是這種硬失敗，還是回傳一份只帶 ChatID 的 output（不是 nil）：前端
	// 樂觀更新的即時泡泡才拿得到 chat_id，不用等重新整理頁面才有機會重送。
	if loopResult == nil {
		_ = repo.ReleaseChatToPending(chat.ID)
		return &AgenticQueryOutput{AgentID: agent.ID, ChatID: chat.ID, UserMessageID: userMessage.ID, ChatStatus: storytellerModel.StoryChatStatusPending}, loopErr
	}

	output := &AgenticQueryOutput{
		AgentID:       agent.ID,
		ChatID:        chat.ID,
		UserMessageID: userMessage.ID,
		ChatStatus:    storytellerModel.StoryChatStatusCompleted,
		RawResponses:  loopResult.RawResponses,
		Provider:      providerAPIKeyRow.Provider,
		ModelName:     modelName,
		Result:        loopResult.FinalText,
		Steps:         loopResult.Steps,
		Proposals:     buildAgentProposalRows(ExtractProposals(loopResult, writeToolNames)),
		Usage:         loopResult.Usage,
	}
	assistantMessage := agenticQueryAssistantMessage(*agent, output, opts.IgnoreAgentPersona)
	usage := buildAgenticQueryUsageLog(repo, userID, providerAPIKeyRow.ID, output)
	if err := repo.CompleteChatMessage(chat.ID, assistantMessage, output.Proposals, usage); err != nil {
		_ = repo.ReleaseChatToPending(chat.ID)
		return nil, err
	}
	output.AssistantMessageID = assistantMessage.ID
	if loopErr != nil {
		return output, loopErr
	}
	return output, nil
}

// RunResendStoryAgenticQuery 針對一筆卡在 pending（沒拿到回覆）狀態的 chat 重新
// 呼叫 provider——不是開新的一輪對話，是把答案補進同一筆 chat，讓歷史上的孤兒
// 問題被補齊，不會另外多出一組重複的問答。使用者這次重送當下的金鑰／模型／
// user_prompt／reply_content／ignore_agent_persona 一律讀當初存的那份（見
// resendStoryAgenticQuery），不相信這次呼叫傳來的文字或人設狀態。
func (s *Service) RunResendStoryAgenticQuery(ctx context.Context, userID uint64, projectPublicID, storyPublicID string, agentID, chatID uint64, opts AgenticQueryOptions) (*AgenticQueryOutput, error) {
	writeToolNames := WriteStorytellerToolNames()
	tools := StorytellerToolRegistry().All()
	tools = CaptureWriteToolsAsProposals(tools, writeToolNames)
	tools = ScopeToolsToProject(tools, projectPublicID)
	return resendStoryAgenticQuery(ctx, s.repo, NewAgenticAIProvider, tools, writeToolNames, userID, projectPublicID, storyPublicID, agentID, chatID, opts)
}

func resendStoryAgenticQuery(ctx context.Context, repo agentRunRepository, providerFactory aiProviderFactory, tools []ToolSpec, writeToolNames map[string]bool, userID uint64, projectPublicID, storyPublicID string, agentID, chatID uint64, opts AgenticQueryOptions) (*AgenticQueryOutput, error) {
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
	modelName := resolveAgentModelName(agent, opts.ModelName)
	if strings.TrimSpace(modelName) == "" {
		return nil, errAgentModelNameNotConfigured
	}
	provider, err := providerFactory(providerAPIKeyRow.Provider, providerAPIKeyRow.Endpoint)
	if err != nil {
		return nil, err
	}
	apiKey, err := decryptProviderAPIKey(providerAPIKeyRow)
	if err != nil {
		return nil, err
	}

	// guarded update：只有卡在 pending、而且真的屬於這個使用者這篇故事的 chat
	// 才搶得到，claimed=0 代表這筆不存在、不是這個使用者/故事的、或已經被完成／
	// 已經有另一個重送請求搶先，兩個重送請求同時按下去也只有一個會真的往下跑。
	claimed, err := repo.ClaimStoryChatForResend(userID, story.ID, chatID)
	if err != nil {
		return nil, err
	}
	if claimed == 0 {
		return nil, errAgenticQueryChatNotResendable
	}

	userMessage, err := repo.ChatUserMessage(chatID)
	if err != nil {
		_ = repo.ReleaseChatToPending(chatID)
		return nil, err
	}
	userPrompt := userMessage.Content
	replyContent, err := agenticQueryReplyContentFromMetadata(repo, userID, project.ID, agenticQueryCurrentTargetStory, story.ID, userMessage.Metadata)
	if err != nil {
		_ = repo.ReleaseChatToPending(chatID)
		return nil, err
	}
	ignoreAgentPersona := agenticQueryIgnoreAgentPersonaFromMetadata(userMessage.Metadata, userMessage.AgentID)

	ctx = WithStorytellerUserID(ctx, userID)
	ctx = WithStorytellerSource(ctx, "agentic_query")

	historyRows, err := repo.RecentStoryAgenticMessages(story.ID, agenticQueryHistoryMessageLimit)
	if err != nil {
		_ = repo.ReleaseChatToPending(chatID)
		return nil, err
	}

	loopResult, loopErr := RunAgentLoop(ctx, AgentLoopRequest{
		Provider:     provider,
		APIKey:       apiKey,
		ModelName:    modelName,
		SystemPrompt: agenticQuerySystemPrompt(*agent, projectPublicID, agenticQueryCurrentTargetStory, story.PublicID, story.Title, ignoreAgentPersona),
		History:      agenticQueryHistoryMessages(historyRows),
		UserPrompt:   agenticQueryUserPromptWithReply(userPrompt, replyContent),
		Tools:        tools,
	})
	if loopResult == nil {
		// 重送本身又失敗了——退回 pending，不要卡死在 in_progress 讓之後永遠沒辦法
		// 再重送一次。
		_ = repo.ReleaseChatToPending(chatID)
		return &AgenticQueryOutput{AgentID: agent.ID, ChatID: chatID, UserMessageID: userMessage.ID, ChatStatus: storytellerModel.StoryChatStatusPending}, loopErr
	}

	output := &AgenticQueryOutput{
		AgentID:       agent.ID,
		ChatID:        chatID,
		UserMessageID: userMessage.ID,
		ChatStatus:    storytellerModel.StoryChatStatusCompleted,
		RawResponses:  loopResult.RawResponses,
		Provider:      providerAPIKeyRow.Provider,
		ModelName:     modelName,
		Result:        loopResult.FinalText,
		Steps:         loopResult.Steps,
		Proposals:     buildAgentProposalRows(ExtractProposals(loopResult, writeToolNames)),
		Usage:         loopResult.Usage,
	}
	assistantMessage := agenticQueryAssistantMessage(*agent, output, ignoreAgentPersona)
	usage := buildAgenticQueryUsageLog(repo, userID, providerAPIKeyRow.ID, output)
	if err := repo.CompleteChatMessage(chatID, assistantMessage, output.Proposals, usage); err != nil {
		_ = repo.ReleaseChatToPending(chatID)
		return nil, err
	}
	output.AssistantMessageID = assistantMessage.ID
	if loopErr != nil {
		return output, loopErr
	}
	return output, nil
}

// RunLoreAgenticQuery 是 RunStoryAgenticQuery 的設定集版本——同一顆前端面板
// （StorytellerAgenticPanel）、同一套工具、同一套 Proposal／ApplyAgentProposal
// 機制，差別只在「目前是哪一筆在編輯」換成 Lore，system prompt 的 @thisLore
// 指向也跟著換（見 agenticQuerySystemPrompt）。
func (s *Service) RunLoreAgenticQuery(ctx context.Context, userID uint64, projectPublicID, lorePublicID string, agentID uint64, userPrompt string, opts AgenticQueryOptions) (*AgenticQueryOutput, error) {
	writeToolNames := WriteStorytellerToolNames()
	tools := StorytellerToolRegistry().All()
	tools = CaptureWriteToolsAsProposals(tools, writeToolNames)
	tools = ScopeToolsToProject(tools, projectPublicID)
	return runLoreAgenticQuery(ctx, s.repo, NewAgenticAIProvider, tools, writeToolNames, userID, projectPublicID, lorePublicID, agentID, userPrompt, opts)
}

func runLoreAgenticQuery(ctx context.Context, repo agentRunRepository, providerFactory aiProviderFactory, tools []ToolSpec, writeToolNames map[string]bool, userID uint64, projectPublicID, lorePublicID string, agentID uint64, userPrompt string, opts AgenticQueryOptions) (*AgenticQueryOutput, error) {
	if strings.TrimSpace(userPrompt) == "" {
		return nil, errAgenticQueryEmptyPrompt
	}
	if len([]rune(opts.ReplyContent)) > agenticQueryReplyContentMaxRunes {
		return nil, errAgenticQueryReplyContentTooLong
	}
	project, err := repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	lore, err := repo.Lore(project.ID, lorePublicID)
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
	modelName := resolveAgentModelName(agent, opts.ModelName)
	if strings.TrimSpace(modelName) == "" {
		return nil, errAgentModelNameNotConfigured
	}
	provider, err := providerFactory(providerAPIKeyRow.Provider, providerAPIKeyRow.Endpoint)
	if err != nil {
		return nil, err
	}
	apiKey, err := decryptProviderAPIKey(providerAPIKeyRow)
	if err != nil {
		return nil, err
	}

	ctx = WithStorytellerUserID(ctx, userID)
	ctx = WithStorytellerSource(ctx, "agentic_query")

	historyRows, err := repo.RecentLoreAgenticMessages(lore.ID, agenticQueryHistoryMessageLimit)
	if err != nil {
		return nil, err
	}

	chat, userMessage := buildPendingLoreAgenticQueryChat(userID, lore.ID, *agent, userPrompt, opts.ReplyReference, opts.IgnoreAgentPersona)
	if err := repo.CreateInProgressChatWithUserMessage(chat, userMessage); err != nil {
		return nil, err
	}

	loopResult, loopErr := RunAgentLoop(ctx, AgentLoopRequest{
		Provider:     provider,
		APIKey:       apiKey,
		ModelName:    modelName,
		SystemPrompt: agenticQuerySystemPrompt(*agent, projectPublicID, agenticQueryCurrentTargetLore, lore.PublicID, lore.Title, opts.IgnoreAgentPersona),
		History:      agenticQueryHistoryMessages(historyRows),
		UserPrompt:   agenticQueryUserPromptWithReply(userPrompt, opts.ReplyContent),
		Tools:        tools,
	})
	if loopResult == nil {
		_ = repo.ReleaseChatToPending(chat.ID)
		return &AgenticQueryOutput{AgentID: agent.ID, ChatID: chat.ID, UserMessageID: userMessage.ID, ChatStatus: storytellerModel.StoryChatStatusPending}, loopErr
	}

	output := &AgenticQueryOutput{
		AgentID:       agent.ID,
		ChatID:        chat.ID,
		UserMessageID: userMessage.ID,
		ChatStatus:    storytellerModel.StoryChatStatusCompleted,
		RawResponses:  loopResult.RawResponses,
		Provider:      providerAPIKeyRow.Provider,
		ModelName:     modelName,
		Result:        loopResult.FinalText,
		Steps:         loopResult.Steps,
		Proposals:     buildAgentProposalRows(ExtractProposals(loopResult, writeToolNames)),
		Usage:         loopResult.Usage,
	}
	assistantMessage := agenticQueryAssistantMessage(*agent, output, opts.IgnoreAgentPersona)
	usage := buildAgenticQueryUsageLog(repo, userID, providerAPIKeyRow.ID, output)
	if err := repo.CompleteChatMessage(chat.ID, assistantMessage, output.Proposals, usage); err != nil {
		_ = repo.ReleaseChatToPending(chat.ID)
		return nil, err
	}
	output.AssistantMessageID = assistantMessage.ID
	if loopErr != nil {
		return output, loopErr
	}
	return output, nil
}

// RunResendLoreAgenticQuery 是 RunResendStoryAgenticQuery 的設定集版本。
func (s *Service) RunResendLoreAgenticQuery(ctx context.Context, userID uint64, projectPublicID, lorePublicID string, agentID, chatID uint64, opts AgenticQueryOptions) (*AgenticQueryOutput, error) {
	writeToolNames := WriteStorytellerToolNames()
	tools := StorytellerToolRegistry().All()
	tools = CaptureWriteToolsAsProposals(tools, writeToolNames)
	tools = ScopeToolsToProject(tools, projectPublicID)
	return resendLoreAgenticQuery(ctx, s.repo, NewAgenticAIProvider, tools, writeToolNames, userID, projectPublicID, lorePublicID, agentID, chatID, opts)
}

func resendLoreAgenticQuery(ctx context.Context, repo agentRunRepository, providerFactory aiProviderFactory, tools []ToolSpec, writeToolNames map[string]bool, userID uint64, projectPublicID, lorePublicID string, agentID, chatID uint64, opts AgenticQueryOptions) (*AgenticQueryOutput, error) {
	project, err := repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	lore, err := repo.Lore(project.ID, lorePublicID)
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
	modelName := resolveAgentModelName(agent, opts.ModelName)
	if strings.TrimSpace(modelName) == "" {
		return nil, errAgentModelNameNotConfigured
	}
	provider, err := providerFactory(providerAPIKeyRow.Provider, providerAPIKeyRow.Endpoint)
	if err != nil {
		return nil, err
	}
	apiKey, err := decryptProviderAPIKey(providerAPIKeyRow)
	if err != nil {
		return nil, err
	}

	claimed, err := repo.ClaimLoreChatForResend(userID, lore.ID, chatID)
	if err != nil {
		return nil, err
	}
	if claimed == 0 {
		return nil, errAgenticQueryChatNotResendable
	}

	userMessage, err := repo.ChatUserMessage(chatID)
	if err != nil {
		_ = repo.ReleaseChatToPending(chatID)
		return nil, err
	}
	userPrompt := userMessage.Content
	replyContent, err := agenticQueryReplyContentFromMetadata(repo, userID, project.ID, agenticQueryCurrentTargetLore, lore.ID, userMessage.Metadata)
	if err != nil {
		_ = repo.ReleaseChatToPending(chatID)
		return nil, err
	}
	ignoreAgentPersona := agenticQueryIgnoreAgentPersonaFromMetadata(userMessage.Metadata, userMessage.AgentID)

	ctx = WithStorytellerUserID(ctx, userID)
	ctx = WithStorytellerSource(ctx, "agentic_query")

	historyRows, err := repo.RecentLoreAgenticMessages(lore.ID, agenticQueryHistoryMessageLimit)
	if err != nil {
		_ = repo.ReleaseChatToPending(chatID)
		return nil, err
	}

	loopResult, loopErr := RunAgentLoop(ctx, AgentLoopRequest{
		Provider:     provider,
		APIKey:       apiKey,
		ModelName:    modelName,
		SystemPrompt: agenticQuerySystemPrompt(*agent, projectPublicID, agenticQueryCurrentTargetLore, lore.PublicID, lore.Title, ignoreAgentPersona),
		History:      agenticQueryHistoryMessages(historyRows),
		UserPrompt:   agenticQueryUserPromptWithReply(userPrompt, replyContent),
		Tools:        tools,
	})
	if loopResult == nil {
		_ = repo.ReleaseChatToPending(chatID)
		return &AgenticQueryOutput{AgentID: agent.ID, ChatID: chatID, UserMessageID: userMessage.ID, ChatStatus: storytellerModel.StoryChatStatusPending}, loopErr
	}

	output := &AgenticQueryOutput{
		AgentID:       agent.ID,
		ChatID:        chatID,
		UserMessageID: userMessage.ID,
		ChatStatus:    storytellerModel.StoryChatStatusCompleted,
		RawResponses:  loopResult.RawResponses,
		Provider:      providerAPIKeyRow.Provider,
		ModelName:     modelName,
		Result:        loopResult.FinalText,
		Steps:         loopResult.Steps,
		Proposals:     buildAgentProposalRows(ExtractProposals(loopResult, writeToolNames)),
		Usage:         loopResult.Usage,
	}
	assistantMessage := agenticQueryAssistantMessage(*agent, output, ignoreAgentPersona)
	usage := buildAgenticQueryUsageLog(repo, userID, providerAPIKeyRow.ID, output)
	if err := repo.CompleteChatMessage(chatID, assistantMessage, output.Proposals, usage); err != nil {
		_ = repo.ReleaseChatToPending(chatID)
		return nil, err
	}
	output.AssistantMessageID = assistantMessage.ID
	if loopErr != nil {
		return output, loopErr
	}
	return output, nil
}

func (s *Service) StoryChatMessageReferenceContent(userID uint64, projectPublicID, storyPublicID string, messageID uint64) (*storytellerModel.AgenticReferenceContentResponse, error) {
	return storyChatMessageReferenceContent(s.repo, userID, projectPublicID, storyPublicID, messageID)
}

func storyChatMessageReferenceContent(repo agentRunRepository, userID uint64, projectPublicID, storyPublicID string, messageID uint64) (*storytellerModel.AgenticReferenceContentResponse, error) {
	project, err := repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	story, err := repo.Story(project.ID, storyPublicID)
	if err != nil {
		return nil, err
	}
	message, err := repo.StoryChatMessageByIDForUserStory(userID, story.ID, messageID)
	if err != nil {
		return nil, err
	}
	return &storytellerModel.AgenticReferenceContentResponse{Content: message.Content}, nil
}

func (s *Service) LoreChatMessageReferenceContent(userID uint64, projectPublicID, lorePublicID string, messageID uint64) (*storytellerModel.AgenticReferenceContentResponse, error) {
	return loreChatMessageReferenceContent(s.repo, userID, projectPublicID, lorePublicID, messageID)
}

func loreChatMessageReferenceContent(repo agentRunRepository, userID uint64, projectPublicID, lorePublicID string, messageID uint64) (*storytellerModel.AgenticReferenceContentResponse, error) {
	project, err := repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	lore, err := repo.Lore(project.ID, lorePublicID)
	if err != nil {
		return nil, err
	}
	message, err := repo.LoreChatMessageByIDForUserLore(userID, lore.ID, messageID)
	if err != nil {
		return nil, err
	}
	return &storytellerModel.AgenticReferenceContentResponse{Content: message.Content}, nil
}

func (s *Service) AgentProposalReferenceContent(userID uint64, projectPublicID, proposalPublicID string) (*storytellerModel.AgenticReferenceContentResponse, error) {
	return agentProposalReferenceContent(s.repo, userID, projectPublicID, proposalPublicID)
}

func agentProposalReferenceContent(repo agentRunRepository, userID uint64, projectPublicID, proposalPublicID string) (*storytellerModel.AgenticReferenceContentResponse, error) {
	project, err := repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	proposal, err := repo.AgentProposalByPublicIDForUserProject(userID, project.ID, proposalPublicID)
	if err != nil {
		return nil, err
	}
	return &storytellerModel.AgenticReferenceContentResponse{Content: agenticQueryProposalReferenceContent(proposal)}, nil
}

var errAgenticQueryEmptyPrompt = agenticQueryError("user_prompt is required")

// errAgenticQueryChatNotResendable 代表要重送的 chat 不存在、不屬於這個使用者／
// 這篇故事或設定集，或者已經不是 pending 狀態（已經拿到回覆，或另一個重送請求
// 剛好搶先一步）。
var errAgenticQueryChatNotResendable = agenticQueryError("chat is not resendable: not found, not owned by this user, or already answered")

type agenticQueryError string

func (e agenticQueryError) Error() string { return string(e) }

// agenticQueryCurrentTargetKind 標出這輪對話是從故事編輯頁還是設定集編輯頁的 AI
// 助理面板發起——兩邊共用同一顆前端面板、同一套工具，差別只在「@thisStory／
// @thisLore」目前指的是哪一筆，以及要記進 storyteller_story_chats 的是 StoryID
// 還是 LoreID（見 buildAgenticQueryChat／buildLoreAgenticQueryChat）。
type agenticQueryCurrentTargetKind string

const (
	agenticQueryCurrentTargetStory agenticQueryCurrentTargetKind = "story"
	agenticQueryCurrentTargetLore  agenticQueryCurrentTargetKind = "lore"
)

func agenticQuerySystemPrompt(agent storytellerModel.Agent, projectPublicID string, currentKind agenticQueryCurrentTargetKind, currentPublicID, currentTitle string, ignoreAgentPersona bool) string {
	base := strings.TrimSpace(`You are Storyteller's writing assistant, running in agentic mode: you can call
read-only tools (storyteller_get_*, storyteller_list_*) to look up the user's stories, lore/worldbuilding
entries, and assets before answering, instead of only seeing what's pasted into this conversation. You can
also call write tools (e.g. storyteller_upsert_story, storyteller_delete_story, storyteller_revert_story) to
propose a change — but these calls do NOT take effect immediately. Each write call is intercepted and recorded
as a pending proposal for the user to review and explicitly confirm; you will get back a message saying so,
not a confirmation that the change happened.

Rules:`)
	if !ignoreAgentPersona {
		base += "\n- Follow the purpose, tone, and constraints configured for this Agent."
	}
	base += `
- Only call tools when you actually need information you don't already have, or when the user is asking you
  to make a concrete change; don't call a tool "just in case" if it isn't needed.
- Every tool call must use the project_public_id given below — you have no access to any other project.
- When proposing a write (storyteller_upsert_story, storyteller_upsert_lore, or any other write tool with a
  content-bearing argument), pass the FULL intended final content as that tool argument, not just a diff or a
  description of the change. The proposal card the user reviews is rendered purely from the arguments you pass
  — it does NOT read your chat reply. Writing the content out in your chat reply instead of (or in addition to)
  the tool argument does not count: the user will see an empty or stale diff and, if they approve it, an empty
  or stale overwrite. Never describe content you didn't actually put in the argument.
- When the intent is to UPDATE an existing story or lore entry (including "@thisStory"/"@thisLore", or anything
  you already have a public_id for from storyteller_get_story/get_lore/list_stories/list_lores), you MUST pass
  that story_public_id/lore_public_id back in the upsert call. Omitting it does not mean "keep everything else
  the same" — it means "create a brand new, separate item" — so leaving it out when you meant to update silently
  creates a duplicate instead, and the user's edit area won't show any change at all.
- After proposing one or more writes, tell the user in your final answer what you've prepared for them to
  review; never claim a write has already been applied.
- If a tool call fails or returns unexpected data, explain what you tried and continue with the best answer
  you can give, don't just give up silently.
- Answer in the language the user wrote in.

Reference syntax — the user's message may contain "@" references that the frontend does not expand for you;
you are expected to resolve them yourself with tools before answering:
- "@thisStory" means the story currently open in the editor (only meaningful when the current context below is
  a story) — call storyteller_get_story with its story_public_id, given below, to read it.
- "@thisLore" means the lore/worldbuilding entry currently open in the editor (only meaningful when the current
  context below is a lore entry) — call storyteller_get_lore with its lore_public_id, given below, to read it.
- "@story:<title>" refers to a story by title — call storyteller_list_stories to find the one whose title
  matches, then storyteller_get_story to read it. If nothing matches closely, say so instead of guessing.
- "@lore:<title>" refers to a lore/worldbuilding entry by title — same pattern with storyteller_list_lores and
  storyteller_get_lore.
- Only resolve a reference if the user's message actually needs its content to answer; don't fetch every
  reference reflexively if the question doesn't depend on it.
- When YOUR OWN final answer mentions a specific story or lore entry by name, refer to it using this same
  syntax — "@thisStory"/"@thisLore" for the one currently open, or "@story:[exact title]"/"@lore:[exact title]"
  for any other one (copy the title exactly, including any brackets in it, between the square brackets) —
  instead of just writing the bare title as plain text. The chat UI turns this syntax into a clickable link
  straight to that item; plain text does not get that treatment.`
	instructions := strings.TrimSpace(agent.DefaultPrompt)
	if instructions != "" && !ignoreAgentPersona {
		base = base + "\n\nAgent-specific instructions:\n" + instructions
	}
	base = base + "\n\nAuthorized project_public_id for this conversation: " + projectPublicID
	if strings.TrimSpace(currentPublicID) != "" {
		if currentKind == agenticQueryCurrentTargetLore {
			base = base + "\nCurrent lore (what \"@thisLore\" refers to): lore_public_id=" + currentPublicID
		} else {
			base = base + "\nCurrent story (what \"@thisStory\" refers to): story_public_id=" + currentPublicID
		}
		if strings.TrimSpace(currentTitle) != "" {
			base = base + ", title=" + currentTitle
		}
	}
	return base
}

// buildPendingAgenticQueryChat 組出「先落地使用者問題」那一步要寫的 chat／訊息，
// 取代原本一次組兩則訊息的 agenticQueryChatMessages——AI 的回覆要等
// agenticQueryAssistantMessage 在 provider 呼叫真的跑完後才另外組。
func buildPendingAgenticQueryChat(userID, storyID uint64, agent storytellerModel.Agent, userPrompt string, replyReference *storytellerModel.AgenticReplyReferenceRequest, ignoreAgentPersona bool) (*storytellerModel.StoryChat, *storytellerModel.StoryChatMessage) {
	chat := &storytellerModel.StoryChat{
		StoryID: &storyID,
		AgentID: agent.ID,
		UserID:  userID,
	}
	return chat, pendingAgenticQueryUserMessage(agent, userPrompt, replyReference, ignoreAgentPersona)
}

// buildPendingLoreAgenticQueryChat 是 buildPendingAgenticQueryChat 的設定集版本，
// 見 RunLoreAgenticQuery 的說明。
func buildPendingLoreAgenticQueryChat(userID, loreID uint64, agent storytellerModel.Agent, userPrompt string, replyReference *storytellerModel.AgenticReplyReferenceRequest, ignoreAgentPersona bool) (*storytellerModel.StoryChat, *storytellerModel.StoryChatMessage) {
	chat := &storytellerModel.StoryChat{
		LoreID:  &loreID,
		AgentID: agent.ID,
		UserID:  userID,
	}
	return chat, pendingAgenticQueryUserMessage(agent, userPrompt, replyReference, ignoreAgentPersona)
}

// messageAgentID 決定訊息列的 agent_id 要不要記——ignoreAgentPersona 為 true
// 代表這輪沒有明確指定人設（純打字送出的一般問答，見 StorytellerAgenticPanel.tsx
// 的 runAgentic 預設路徑），這種情況下 agent_id 只是「這次呼叫剛好用哪個 agent
// 記錄解析 provider/model」的技術細節，不是使用者的刻意選擇，留 NULL 讓前端
// 的訊息泡泡不要標一個誤導性的 Agent 名稱（見 DevelopDocuments/storyteller/
// agentic_ai_storyteller/Phase1至7工作項規劃.md 的「未來待辦」第二項）。明確
// 用 /Agent名稱 切換過的（ignoreAgentPersona=false）才記真正的 agent_id。
func messageAgentID(agentID uint64, ignoreAgentPersona bool) *uint64 {
	if ignoreAgentPersona {
		return nil
	}
	id := agentID
	return &id
}

func pendingAgenticQueryUserMessage(agent storytellerModel.Agent, userPrompt string, replyReference *storytellerModel.AgenticReplyReferenceRequest, ignoreAgentPersona bool) *storytellerModel.StoryChatMessage {
	return &storytellerModel.StoryChatMessage{
		AgentID:  messageAgentID(agent.ID, ignoreAgentPersona),
		Role:     storytellerModel.ChatMessageRoleUser,
		Content:  userPrompt,
		Metadata: agenticQueryUserMessageMetadata(replyReference, ignoreAgentPersona),
	}
}

// agenticQueryAssistantMessage 組出 provider 呼叫跑完後要補進 chat 的 AI 回覆
// 那一則訊息，搭配 repo.CompleteChatMessage 使用。
func agenticQueryAssistantMessage(agent storytellerModel.Agent, output *AgenticQueryOutput, ignoreAgentPersona bool) *storytellerModel.StoryChatMessage {
	return &storytellerModel.StoryChatMessage{
		AgentID:             messageAgentID(agent.ID, ignoreAgentPersona),
		Role:                storytellerModel.ChatMessageRoleAssistant,
		Content:             output.Result,
		Metadata:            agenticQueryOutputMetadata(output),
		RawProviderResponse: rawProviderResponseJSON(output.RawResponses),
	}
}

// rawProviderResponseJSON 把每一輪 provider.Generate() 呼叫收到的原始 response
// body 陣列封裝成一個 JSON 字串，存進 StoryChatMessage.RawProviderResponse 這個
// 純除錯用欄位——agentic（可能一輪對話打好幾次 provider）跟 skill（固定一次）
// 兩條路徑共用同一個封裝方式，之後要比對格式才不會兩邊長得不一樣。空陣列回傳
// nil，不佔欄位空間，也跟「有記錄但剛好是空」的語意區分開。
func rawProviderResponseJSON(rawResponses []string) *string {
	if len(rawResponses) == 0 {
		return nil
	}
	body, err := json.Marshal(rawResponses)
	if err != nil {
		return nil
	}
	value := string(body)
	return &value
}

type agenticQueryReplyReferenceMetadata struct {
	Kind             string `json:"kind"`
	MessageID        uint64 `json:"message_id,omitempty"`
	ProposalPublicID string `json:"proposal_public_id,omitempty"`
	Summary          string `json:"summary,omitempty"`
}

const (
	agenticQueryReplyReferenceKindMessage  = "message"
	agenticQueryReplyReferenceKindProposal = "proposal"
)

func normalizeAgenticReplyReference(ref *storytellerModel.AgenticReplyReferenceRequest) *agenticQueryReplyReferenceMetadata {
	if ref == nil {
		return nil
	}
	switch ref.Kind {
	case agenticQueryReplyReferenceKindMessage:
		if ref.MessageID == 0 {
			return nil
		}
		return &agenticQueryReplyReferenceMetadata{
			Kind:      ref.Kind,
			MessageID: ref.MessageID,
			Summary:   strings.TrimSpace(ref.Summary),
		}
	case agenticQueryReplyReferenceKindProposal:
		proposalPublicID := strings.TrimSpace(ref.ProposalPublicID)
		if proposalPublicID == "" {
			return nil
		}
		return &agenticQueryReplyReferenceMetadata{
			Kind:             ref.Kind,
			ProposalPublicID: proposalPublicID,
			Summary:          strings.TrimSpace(ref.Summary),
		}
	default:
		return nil
	}
}

// agenticQueryUserMessageMetadata 只把「回覆／否決提案」的短參照寫進使用者訊息
// Metadata。完整內容仍透過 request.reply_content 餵給這一輪 provider，但不再
// 持久化一份重複快照；重送時用 reply_reference 回頭查原始 message/proposal。
// user 這則訊息一律標 mode:"agentic_query"（跟 skill 模式的 user 訊息一直都會
// 標自己的 mode 對齊）——之前只有 assistant 那則訊息會標，前端用「metadata 有
// steps」判斷是不是 agentic 對話，純問答沒呼叫工具時 steps 是空陣列，重新整理
// 頁面後這種訊息、以及只存了問題還沒拿到回覆的孤兒訊息，都會被前端誤判成
// skill 模式（見 StorytellerAgenticPanel.tsx 的 parseAgenticMetadata／
// skillHistoryMessages）。兩則訊息都標 mode，前端才能不管有沒有工具呼叫、有
// 沒有拿到回覆，都能正確辨識出「這是 agentic 對話」。
func agenticQueryUserMessageMetadata(replyReference *storytellerModel.AgenticReplyReferenceRequest, ignoreAgentPersona bool) string {
	type userMessageMetadata struct {
		Mode               string                              `json:"mode"`
		ReplyReference     *agenticQueryReplyReferenceMetadata `json:"reply_reference,omitempty"`
		IgnoreAgentPersona bool                                `json:"ignore_agent_persona"`
	}
	body, err := json.Marshal(userMessageMetadata{
		Mode:               "agentic_query",
		ReplyReference:     normalizeAgenticReplyReference(replyReference),
		IgnoreAgentPersona: ignoreAgentPersona,
	})
	if err != nil {
		return `{"mode":"agentic_query"}`
	}
	return string(body)
}

// agenticQueryReplyContentFromMetadata 是 agenticQueryUserMessageMetadata 的反向
// 操作，重送時用 metadata 裡的參照查回完整內容。舊資料可能仍有 reply_content
// 快照，先當 fallback 讀掉，避免既有 pending 訊息重送時降級。
func agenticQueryReplyContentFromMetadata(repo agentRunRepository, userID, projectID uint64, currentKind agenticQueryCurrentTargetKind, currentID uint64, metadata string) (string, error) {
	var meta struct {
		ReplyContent   string                              `json:"reply_content"`
		ReplyReference *agenticQueryReplyReferenceMetadata `json:"reply_reference"`
	}
	if err := json.Unmarshal([]byte(metadata), &meta); err != nil {
		return "", nil
	}
	if strings.TrimSpace(meta.ReplyContent) != "" {
		return meta.ReplyContent, nil
	}
	if meta.ReplyReference == nil {
		return "", nil
	}
	switch meta.ReplyReference.Kind {
	case agenticQueryReplyReferenceKindMessage:
		message, err := agenticQueryReferencedMessage(repo, userID, currentKind, currentID, meta.ReplyReference.MessageID)
		if err != nil || message == nil {
			return "", err
		}
		return message.Content, nil
	case agenticQueryReplyReferenceKindProposal:
		proposal, err := repo.AgentProposalByPublicIDForUserProject(userID, projectID, meta.ReplyReference.ProposalPublicID)
		if err != nil {
			return "", err
		}
		return agenticQueryProposalReferenceContent(proposal), nil
	default:
		return "", nil
	}
}

func agenticQueryReferencedMessage(repo agentRunRepository, userID uint64, currentKind agenticQueryCurrentTargetKind, currentID, messageID uint64) (*storytellerModel.StoryChatMessage, error) {
	if messageID == 0 {
		return nil, nil
	}
	if currentKind == agenticQueryCurrentTargetLore {
		return repo.LoreChatMessageByIDForUserLore(userID, currentID, messageID)
	}
	return repo.StoryChatMessageByIDForUserStory(userID, currentID, messageID)
}

func agenticQueryProposalReferenceContent(proposal *storytellerModel.AgentProposal) string {
	var arguments json.RawMessage = []byte("{}")
	if proposal != nil && json.Valid([]byte(proposal.Arguments)) {
		arguments = json.RawMessage(proposal.Arguments)
	}
	toolName := ""
	if proposal != nil {
		toolName = proposal.ToolName
	}
	body, err := json.MarshalIndent(struct {
		ToolName  string          `json:"tool_name"`
		Arguments json.RawMessage `json:"arguments"`
	}{
		ToolName:  toolName,
		Arguments: arguments,
	}, "", "  ")
	if err != nil {
		body = []byte(`{"tool_name":"","arguments":{}}`)
	}
	return "Reference rejected proposal: " + toolName + "\n<<<REJECTED_PROPOSAL_REFERENCE_CONTENT\n" + string(body) + "\nREJECTED_PROPOSAL_REFERENCE_CONTENT"
}

func agenticQueryIgnoreAgentPersonaFromMetadata(metadata string, agentID *uint64) bool {
	var meta struct {
		IgnoreAgentPersona *bool `json:"ignore_agent_persona"`
	}
	if err := json.Unmarshal([]byte(metadata), &meta); err == nil && meta.IgnoreAgentPersona != nil {
		return *meta.IgnoreAgentPersona
	}
	// 舊資料沒有 ignore_agent_persona 欄位；messageAgentID 會在 ignore=true 時存 NULL，
	// 用這個既有落地結果反推，讓舊 pending row 重送時盡量貼近原本那輪。
	return agentID == nil
}

// agenticQueryOutputMetadata 把這輪呼叫過的工具過程記成 JSON，存進既有
// StoryChatMessage 的 Metadata 欄位（沿用 agentRunOutputMetadata 的既有慣例）。
// 這個 repo 的 ChatMessageRole 目前只有 system/user/assistant 三種，沒有獨立的
// "tool" 角色，要幫這個加一個新角色是 DB schema 異動，這輪刻意不做（範圍
// 控制）——多輪工具呼叫的完整過程改用這個 metadata JSON 記錄，不逐則存成獨立
// 訊息列。
//
// Steps 直接重用 output.ToResponse() 轉出來的 DTO，跟這輪對話當下回給前端的
// AgenticQueryResponse 是同一份形狀（tool_calls 含 arguments、results 含完整
// content），這樣前端重新載入歷史訊息時解析 metadata 才能還原出跟當下即時畫面
// 一樣的「工作軌跡」，而不是只剩工具名稱的殘缺版本。Proposals 不再存在這裡——
// 已經是 storyteller_agent_proposals 的真實資料列（見 AgentProposal 的說明），
// 前端讀 StoryChatMessageOutput.Proposals 就有最新狀態，不用再從這份寫死的
// 快照猜「還沒被套用或還沒過期」。
func agenticQueryOutputMetadata(output *AgenticQueryOutput) string {
	type queryMetadata struct {
		Mode      string                               `json:"mode"`
		StepCount int                                  `json:"step_count"`
		Steps     []storytellerModel.AgenticStepOutput `json:"steps,omitempty"`
	}
	response := output.ToResponse()
	meta := queryMetadata{
		Mode:      "agentic_query",
		StepCount: len(output.Steps),
		Steps:     response.Steps,
	}
	body, err := json.Marshal(meta)
	if err != nil {
		return "{}"
	}
	return string(body)
}

// buildAgenticQueryUsageLog 沿用既有 buildAgentUsageLog 的欄位慣例，差別只在
// usage 來源是 AgentLoopResult 累加過的多輪用量，不是單一次 provider 呼叫。
// Price 是寫入當下查一次 AgentModelPrice 存的快照，理由同 buildAgentUsageLog。
func buildAgenticQueryUsageLog(repo agentRunRepository, userID, providerAPIKeyID uint64, output *AgenticQueryOutput) *storytellerModel.AgentUsageLog {
	if output == nil || output.Usage == nil {
		return nil
	}
	price, _ := repo.AgentModelPrice(output.Provider, output.ModelName)
	return &storytellerModel.AgentUsageLog{
		UserID:           userID,
		ProviderAPIKeyID: providerAPIKeyID,
		// Provider／ModelName 用這次「實際」解析出來的（output 已經套用過
		// key／model 覆寫），不是 Agent 記錄的靜態預設。
		Provider:     output.Provider,
		ModelName:    output.ModelName,
		Price:        price,
		InputTokens:  output.Usage.InputTokens,
		OutputTokens: output.Usage.OutputTokens,
		TotalTokens:  output.Usage.TotalTokens,
	}
}
