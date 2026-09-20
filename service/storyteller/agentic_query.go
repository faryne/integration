package storyteller

import (
	"context"
	"encoding/json"
	"fmt"
	"strings"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/service/background"
	"faryne.dev/service/log"
	"go.uber.org/zap"
)

// AgenticQueryOutput 是 RunStoryAgenticQuery 的回傳結果。
type AgenticQueryOutput struct {
	AgentID uint64
	// ChatID 是這輪對話存進 storyteller_story_chats 的那筆——不管最後有沒有拿到
	// 回覆都會帶回前端（見 submitAgenticQuery／resubmitAgenticQuery 在
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
	// （PublicID 在存檔前就先產生好，見 submitAgenticQuery），前端呼叫
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

type agenticBackgroundWork interface {
	Context() context.Context
	Track(name string) (func(), error)
}

var agenticQueryBackgroundWork agenticBackgroundWork = background.Default()

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

func agenticQueryHistoryAgentNames(repo agentRunRepository, userID uint64, rows []storytellerModel.StoryChatMessage) (map[uint64]string, error) {
	seen := make(map[uint64]bool)
	ids := make([]uint64, 0)
	for _, row := range rows {
		if row.AgentID == nil || seen[*row.AgentID] {
			continue
		}
		seen[*row.AgentID] = true
		ids = append(ids, *row.AgentID)
	}
	if len(ids) == 0 {
		return nil, nil
	}
	agents, err := repo.AgentsByIDs(userID, ids)
	if err != nil {
		return nil, err
	}
	names := make(map[uint64]string, len(agents))
	for _, agent := range agents {
		names[agent.ID] = agent.Name
	}
	return names, nil
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

// ErrAgenticQueryServerDraining 代表程序已進入優雅重啟／關機階段，不能再接受新的
// 背景 agentic 工作，否則 drain 可能永遠等不到乾淨狀態。
var ErrAgenticQueryServerDraining = agenticQueryError("server is restarting, please try again later")

// errAgenticQueryChatNotResendable 代表要重送的 chat 不存在、不屬於這個使用者／
// 這篇故事或設定集，或者已經不是 pending 狀態（已經拿到回覆，或另一個重送請求
// 剛好搶先一步）。
// errAgentSkillResendUnavailable：舊版 skill 訊息沒有存 request_xml，沒有原始內容可以重放。
var errAgentSkillResendUnavailable = agenticQueryError("this skill message has no stored request and cannot be resent; please run it again")

var errAgenticQueryChatNotResendable = agenticQueryError("chat is not resendable: not found, not owned by this user, or already answered")

type agenticQueryError string

func (e agenticQueryError) Error() string { return string(e) }

func logAgenticQueryBackgroundError(message string, chatID uint64, err error) {
	if err == nil {
		return
	}
	log.Logger().Warn(message, zap.Uint64("chat_id", chatID), zap.Error(err))
}

// agenticQueryCurrentTargetKind 標出這輪對話是從故事編輯頁還是設定集編輯頁的 AI
// 助理面板發起——兩邊共用同一顆前端面板、同一套工具，差別只在「@thisStory／
// @thisLore」目前指的是哪一筆，以及要記進 storyteller_story_chats 的是 StoryID
// 還是 LoreID（見 buildAgenticQueryChat／buildLoreAgenticQueryChat）。
type agenticQueryCurrentTargetKind string

const (
	agenticQueryCurrentTargetStory agenticQueryCurrentTargetKind = "story"
	agenticQueryCurrentTargetLore  agenticQueryCurrentTargetKind = "lore"
)

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

func pendingAgenticQueryUserMessage(agent storytellerModel.Agent, userPrompt string, replyReference *storytellerModel.AgenticReplyReferenceRequest, ignoreAgentPersona bool, requestXML string) *storytellerModel.StoryChatMessage {
	return &storytellerModel.StoryChatMessage{
		AgentID: messageAgentID(agent.ID, ignoreAgentPersona),
		Role:    storytellerModel.ChatMessageRoleUser,
		Content: userPrompt,
		Metadata: agentUserMessageMetadata{
			Mode:               "agentic_query",
			IgnoreAgentPersona: &ignoreAgentPersona,
			ReplyReference:     normalizeAgenticReplyReference(replyReference),
			RequestXML:         requestXML,
		}.JSON(),
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
	return "Rejected proposal: " + toolName + "\n" + string(body)
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
	type usageMetadata struct {
		InputTokens  int `json:"input_tokens"`
		OutputTokens int `json:"output_tokens"`
		TotalTokens  int `json:"total_tokens"`
	}
	type queryMetadata struct {
		Mode      string                               `json:"mode"`
		StepCount int                                  `json:"step_count"`
		Steps     []storytellerModel.AgenticStepOutput `json:"steps,omitempty"`
		Usage     *usageMetadata                       `json:"usage,omitempty"`
	}
	response := output.ToResponse()
	meta := queryMetadata{
		Mode:      "agentic_query",
		StepCount: len(output.Steps),
		Steps:     response.Steps,
	}
	if output.Usage != nil {
		meta.Usage = &usageMetadata{
			InputTokens:  output.Usage.InputTokens,
			OutputTokens: output.Usage.OutputTokens,
			TotalTokens:  output.Usage.TotalTokens,
		}
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
