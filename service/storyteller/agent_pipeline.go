package storyteller

import (
	"context"
	"strings"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

// 單一非同步 pipeline：一般對話（agentic query）、重送（resend）、skill（/rewrite
// 等）全部走 submitAgentRun——送出當下只做「這次呼叫合不合法、要用哪把 key／哪個
// model／哪個 target」這些必須同步驗證的事，落地使用者這則指令後就馬上回應
// in_progress，真正呼叫 provider 在背景 goroutine 跑完才補進 assistant 訊息。不再有
// 同步版本：不讓使用者的請求被 provider 的等待時間、或 HTTP client 的固定逾時卡住
// （見「已知 Bug 記錄」：60 秒逾時曾讓合法但較慢的生成被砍掉）。
//
// 三種呼叫的差別只有兩處，各自用 closure 帶進來，其餘（解析、Track、goroutine、
// 失敗處理）完全共用：Begin＝怎麼落地這則使用者訊息；Run＝背景怎麼呼叫 provider。
// story 與 lore 只差 agentRunTarget.Kind，不再各複製一份。

// agentSubmitDeps 是 pipeline 需要的外部依賴，測試可以整組換掉。
type agentSubmitDeps struct {
	Repo            agentRunRepository
	Work            agenticBackgroundWork
	ProviderFactory aiProviderFactory
	// AgenticTools 組出一般對話可用的工具與「哪些是寫入類」的名單，預設 agenticQueryTools。
	AgenticTools func(projectPublicID string) ([]ToolSpec, map[string]bool)
}

func (s *Service) submitDeps() agentSubmitDeps {
	return agentSubmitDeps{Repo: s.repo, Work: agenticQueryBackgroundWork, ProviderFactory: NewAgenticAIProvider, AgenticTools: agenticQueryTools}
}

// agentRunPlan 是解析完的「這次呼叫要用什麼」：Provider／Model 用這次實際解析出來的，
// 不是 Agent 記錄的靜態預設——Agent 只保留人設/prompt，key／model 各自獨立覆寫，
// 可能連 provider 都跟 Agent 原本設定的不一樣（見 resolveAgentProviderAPIKey）。
type agentRunPlan struct {
	UserID          uint64
	ProjectPublicID string
	Project         *storytellerModel.Project
	Target          agentRunTarget
	Agent           *storytellerModel.Agent
	Key             *storytellerModel.ProviderAPIKey
	ModelName       string
	Provider        AIProvider
	APIKey          string
}

// agentRunJob 是 Begin 落地完使用者訊息後，交給背景 goroutine 的工作。
type agentRunJob struct {
	ChatID        uint64
	UserMessageID uint64
	Run           func(ctx context.Context) error
}

type agentSubmitParams struct {
	UserID           uint64
	ProjectPublicID  string
	TargetKind       agenticQueryCurrentTargetKind
	TargetPublicID   string
	AgentID          uint64
	ProviderAPIKeyID *uint64
	ModelName        string
	TrackName        string
	// Begin 在解析完 plan、Track 成功之後呼叫；回傳錯誤時 pipeline 負責 done()。
	Begin func(plan *agentRunPlan) (*agentRunJob, error)
}

// agentRunAck 是送出當下的回應（chat 已進 in_progress，結果還沒出來）。
type agentRunAck struct {
	AgentID       uint64
	ChatID        uint64
	UserMessageID uint64
	Provider      storytellerModel.AgentProvider
	ModelName     string
}

func submitAgentRun(deps agentSubmitDeps, p agentSubmitParams) (*agentRunAck, error) {
	plan, err := resolveAgentRunPlan(deps, p)
	if err != nil {
		return nil, err
	}
	done, err := deps.Work.Track(p.TrackName)
	if err != nil {
		return nil, ErrAgenticQueryServerDraining
	}
	job, err := p.Begin(plan)
	if err != nil {
		done()
		return nil, err
	}
	go func() {
		defer done()
		logAgenticQueryBackgroundError(p.TrackName+" background run failed", job.ChatID, job.Run(deps.Work.Context()))
	}()
	return &agentRunAck{AgentID: plan.Agent.ID, ChatID: job.ChatID, UserMessageID: job.UserMessageID, Provider: plan.Key.Provider, ModelName: plan.ModelName}, nil
}

func resolveAgentRunPlan(deps agentSubmitDeps, p agentSubmitParams) (*agentRunPlan, error) {
	repo := deps.Repo
	project, err := repo.ProjectByPublicIDForUser(p.UserID, p.ProjectPublicID)
	if err != nil {
		return nil, err
	}
	target, err := lookupAgentRunTarget(repo, project.ID, p.TargetKind, p.TargetPublicID)
	if err != nil {
		return nil, err
	}
	agent, err := repo.Agent(p.UserID, p.AgentID)
	if err != nil {
		return nil, err
	}
	key, err := resolveAgentProviderAPIKey(repo.ProviderAPIKey, p.UserID, agent, p.ProviderAPIKeyID)
	if err != nil {
		return nil, err
	}
	modelName := resolveAgentModelName(agent, p.ModelName)
	if strings.TrimSpace(modelName) == "" {
		return nil, errAgentModelNameNotConfigured
	}
	provider, err := deps.ProviderFactory(key.Provider, key.Endpoint)
	if err != nil {
		return nil, err
	}
	apiKey, err := decryptProviderAPIKey(key)
	if err != nil {
		return nil, err
	}
	return &agentRunPlan{UserID: p.UserID, ProjectPublicID: p.ProjectPublicID, Project: project, Target: target, Agent: agent, Key: key, ModelName: modelName, Provider: provider, APIKey: apiKey}, nil
}

func lookupAgentRunTarget(repo agentRunRepository, projectID uint64, kind agenticQueryCurrentTargetKind, publicID string) (agentRunTarget, error) {
	if kind == agenticQueryCurrentTargetLore {
		lore, err := repo.Lore(projectID, publicID)
		if err != nil {
			return agentRunTarget{}, err
		}
		return agentRunTarget{Kind: kind, ID: lore.ID, PublicID: lore.PublicID, Title: lore.Title}, nil
	}
	story, err := repo.Story(projectID, publicID)
	if err != nil {
		return agentRunTarget{}, err
	}
	return agentRunTarget{Kind: agenticQueryCurrentTargetStory, ID: story.ID, PublicID: story.PublicID, Title: story.Title}, nil
}

// newAgentChat 依 target 種類決定 chat 掛在 story 還是 lore 底下。
func newAgentChat(target agentRunTarget, userID, agentID uint64) *storytellerModel.StoryChat {
	id := target.ID
	chat := &storytellerModel.StoryChat{AgentID: agentID, UserID: userID}
	if target.Kind == agenticQueryCurrentTargetLore {
		chat.LoreID = &id
	} else {
		chat.StoryID = &id
	}
	return chat
}

func recentAgenticHistory(repo agentRunRepository, target agentRunTarget) ([]storytellerModel.StoryChatMessage, error) {
	if target.Kind == agenticQueryCurrentTargetLore {
		return repo.RecentLoreAgenticMessages(target.ID, agenticQueryHistoryMessageLimit)
	}
	return repo.RecentStoryAgenticMessages(target.ID, agenticQueryHistoryMessageLimit)
}

// claimChatForResend 是 guarded update：只有卡在 pending、而且真的屬於這個使用者這
// 篇故事／設定集的 chat 才搶得到，0 代表不存在、不屬於這個使用者、已經完成，或已經有
// 另一個重送請求搶先——兩個重送同時按下去也只有一個會真的往下跑。
func claimChatForResend(repo agentRunRepository, userID uint64, target agentRunTarget, chatID uint64) (int64, error) {
	if target.Kind == agenticQueryCurrentTargetLore {
		return repo.ClaimLoreChatForResend(userID, target.ID, chatID)
	}
	return repo.ClaimStoryChatForResend(userID, target.ID, chatID)
}

// agenticQueryTools 組出一般對話可用的工具：寫入類工具改成攔下來記成 proposal
// （見 CaptureWriteToolsAsProposals），並把每個工具呼叫鎖在 projectPublicID 底下。
func agenticQueryTools(projectPublicID string) ([]ToolSpec, map[string]bool) {
	writeToolNames := WriteStorytellerToolNames()
	tools := CaptureWriteToolsAsProposals(StorytellerToolRegistry().All(), writeToolNames)
	return ScopeToolsToProject(tools, projectPublicID), writeToolNames
}

func (a *agentRunAck) toAgenticQueryOutput() *AgenticQueryOutput {
	return &AgenticQueryOutput{
		AgentID:       a.AgentID,
		ChatID:        a.ChatID,
		UserMessageID: a.UserMessageID,
		ChatStatus:    storytellerModel.StoryChatStatusInProgress,
		Provider:      a.Provider,
		ModelName:     a.ModelName,
	}
}

// ---- 一般對話（agentic query）----

// RunStoryAgenticQuery：在故事編輯頁的 AI 助理對話裡，讓 agent 自己讀這個 project 底下
// 的故事／設定集／資產再回答。寫入類工具只會被記成 Proposals，實際落地一定要等使用者
// 呼叫 ApplyAgentProposal 明確確認。
func (s *Service) RunStoryAgenticQuery(ctx context.Context, userID uint64, projectPublicID, storyPublicID string, agentID uint64, userPrompt string, opts AgenticQueryOptions) (*AgenticQueryOutput, error) {
	return submitAgenticQuery(s.submitDeps(), userID, projectPublicID, agenticQueryCurrentTargetStory, storyPublicID, agentID, userPrompt, opts)
}

// RunLoreAgenticQuery 是 RunStoryAgenticQuery 的設定集版本，「目前在編輯哪一筆」換成 Lore。
func (s *Service) RunLoreAgenticQuery(ctx context.Context, userID uint64, projectPublicID, lorePublicID string, agentID uint64, userPrompt string, opts AgenticQueryOptions) (*AgenticQueryOutput, error) {
	return submitAgenticQuery(s.submitDeps(), userID, projectPublicID, agenticQueryCurrentTargetLore, lorePublicID, agentID, userPrompt, opts)
}

// RunResendStoryAgenticQuery 針對一筆卡在 pending（沒拿到回覆）狀態的 chat 重新呼叫
// provider——不是開新的一輪對話，是把答案補進同一筆 chat，不會多出一組重複的問答。
// 金鑰／模型以外的內容（user_prompt／reply／ignore_agent_persona）一律讀當初存的那份，
// 不相信這次呼叫傳來的文字或人設狀態。
func (s *Service) RunResendStoryAgenticQuery(ctx context.Context, userID uint64, projectPublicID, storyPublicID string, agentID, chatID uint64, opts AgenticQueryOptions) (*AgenticQueryOutput, error) {
	return resubmitAgenticQuery(s.submitDeps(), userID, projectPublicID, agenticQueryCurrentTargetStory, storyPublicID, agentID, chatID, opts)
}

func (s *Service) RunResendLoreAgenticQuery(ctx context.Context, userID uint64, projectPublicID, lorePublicID string, agentID, chatID uint64, opts AgenticQueryOptions) (*AgenticQueryOutput, error) {
	return resubmitAgenticQuery(s.submitDeps(), userID, projectPublicID, agenticQueryCurrentTargetLore, lorePublicID, agentID, chatID, opts)
}

func submitAgenticQuery(deps agentSubmitDeps, userID uint64, projectPublicID string, kind agenticQueryCurrentTargetKind, targetPublicID string, agentID uint64, userPrompt string, opts AgenticQueryOptions) (*AgenticQueryOutput, error) {
	if strings.TrimSpace(userPrompt) == "" {
		return nil, errAgenticQueryEmptyPrompt
	}
	if len([]rune(opts.ReplyContent)) > agenticQueryReplyContentMaxRunes {
		return nil, errAgenticQueryReplyContentTooLong
	}
	tools, writeToolNames := deps.AgenticTools(projectPublicID)
	ack, err := submitAgentRun(deps, agentSubmitParams{
		UserID: userID, ProjectPublicID: projectPublicID, TargetKind: kind, TargetPublicID: targetPublicID, AgentID: agentID,
		ProviderAPIKeyID: opts.ProviderAPIKeyID, ModelName: opts.ModelName,
		TrackName: "storyteller.agentic_query." + string(kind),
		Begin: func(plan *agentRunPlan) (*agentRunJob, error) {
			historyRows, err := recentAgenticHistory(deps.Repo, plan.Target)
			if err != nil {
				return nil, err
			}
			// 先把使用者的問題落地（chat 進 in_progress）：就算等下 provider 呼叫逾時／
			// process 被重啟而拿不到答案，使用者也不會連自己問了什麼都找不到；之後可以用
			// 「重送」補完這輪，不用整句重打。
			chat := newAgentChat(plan.Target, userID, plan.Agent.ID)
			userMessage := pendingAgenticQueryUserMessage(*plan.Agent, userPrompt, opts.ReplyReference, opts.IgnoreAgentPersona)
			if err := deps.Repo.CreateInProgressChatWithUserMessage(chat, userMessage); err != nil {
				return nil, err
			}
			return &agentRunJob{ChatID: chat.ID, UserMessageID: userMessage.ID, Run: func(ctx context.Context) error {
				_, err := completeAgenticQuery(ctx, deps.Repo, plan, tools, writeToolNames, chat.ID, userMessage.ID, userPrompt, opts.ReplyContent, opts.IgnoreAgentPersona, historyRows)
				return err
			}}, nil
		},
	})
	if err != nil {
		return nil, err
	}
	return ack.toAgenticQueryOutput(), nil
}

func resubmitAgenticQuery(deps agentSubmitDeps, userID uint64, projectPublicID string, kind agenticQueryCurrentTargetKind, targetPublicID string, agentID, chatID uint64, opts AgenticQueryOptions) (*AgenticQueryOutput, error) {
	tools, writeToolNames := deps.AgenticTools(projectPublicID)
	repo := deps.Repo
	ack, err := submitAgentRun(deps, agentSubmitParams{
		UserID: userID, ProjectPublicID: projectPublicID, TargetKind: kind, TargetPublicID: targetPublicID, AgentID: agentID,
		ProviderAPIKeyID: opts.ProviderAPIKeyID, ModelName: opts.ModelName,
		TrackName: "storyteller.agentic_query." + string(kind) + "_resend",
		Begin: func(plan *agentRunPlan) (*agentRunJob, error) {
			claimed, err := claimChatForResend(repo, userID, plan.Target, chatID)
			if err != nil {
				return nil, err
			}
			if claimed == 0 {
				return nil, errAgenticQueryChatNotResendable
			}
			// 認領之後任何一步失敗都要把 chat 退回 pending，不能讓它卡在 in_progress。
			fail := func(err error) (*agentRunJob, error) {
				_ = repo.ReleaseChatToPending(chatID)
				return nil, err
			}
			userMessage, err := repo.ChatUserMessage(chatID)
			if err != nil {
				return fail(err)
			}
			replyContent, err := agenticQueryReplyContentFromMetadata(repo, userID, plan.Project.ID, plan.Target.Kind, plan.Target.ID, userMessage.Metadata)
			if err != nil {
				return fail(err)
			}
			ignoreAgentPersona := agenticQueryIgnoreAgentPersonaFromMetadata(userMessage.Metadata, userMessage.AgentID)
			historyRows, err := recentAgenticHistory(repo, plan.Target)
			if err != nil {
				return fail(err)
			}
			return &agentRunJob{ChatID: chatID, UserMessageID: userMessage.ID, Run: func(ctx context.Context) error {
				_, err := completeAgenticQuery(ctx, repo, plan, tools, writeToolNames, chatID, userMessage.ID, userMessage.Content, replyContent, ignoreAgentPersona, historyRows)
				return err
			}}, nil
		},
	})
	if err != nil {
		return nil, err
	}
	return ack.toAgenticQueryOutput(), nil
}

// completeAgenticQuery 是背景 goroutine 實際呼叫 provider、把結果補進 chat 的部分。
// 呼叫失敗時把 chat 退回 pending 讓使用者知道「沒拿到回覆」，不會讓 chat 卡在 in_progress。
func completeAgenticQuery(ctx context.Context, repo agentRunRepository, plan *agentRunPlan, tools []ToolSpec, writeToolNames map[string]bool, chatID, userMessageID uint64, userPrompt, replyContent string, ignoreAgentPersona bool, historyRows []storytellerModel.StoryChatMessage) (*AgenticQueryOutput, error) {
	agent, userID := *plan.Agent, plan.UserID
	// 這組工具的 Handler 內部都是靠 storytellerUserIDFromContext／storytellerSourceFromContext
	// 從 ctx 拿身分，不是走參數傳遞（MCP 那層也是同樣的機制，見 tool_registry_context.go），
	// 一定要先把身分塞進 ctx，不然每個工具呼叫都會失敗。
	ctx = WithStorytellerUserID(ctx, userID)
	ctx = WithStorytellerSource(ctx, "agentic_query")
	pending := &AgenticQueryOutput{AgentID: agent.ID, ChatID: chatID, UserMessageID: userMessageID, ChatStatus: storytellerModel.StoryChatStatusPending}
	historyAgentNames, err := agenticQueryHistoryAgentNames(repo, userID, historyRows)
	if err != nil {
		_ = repo.ReleaseChatToPending(chatID)
		return pending, err
	}

	loopResult, loopErr := RunAgentLoop(ctx, AgentLoopRequest{
		Provider:     plan.Provider,
		APIKey:       plan.APIKey,
		ModelName:    plan.ModelName,
		SystemPrompt: agenticQuerySystemPrompt(agent, plan.ProjectPublicID, plan.Target.Kind, plan.Target.PublicID, plan.Target.Title, ignoreAgentPersona),
		History:      agenticQueryHistoryMessages(historyRows, historyAgentNames),
		UserPrompt:   agenticQueryUserPromptWithReply(userPrompt, replyContent),
		Tools:        tools,
	})
	// loopResult 就算在 loopErr 非 nil 時（例如撞到步數上限）也可能有值——RunAgentLoop
	// 刻意在中止時仍回傳累積到目前為止的 Steps/Usage，照樣記進 usage log／chat 歷史，
	// 不能因為沒拿到最終答案就丟掉已經發生、已經花錢的呼叫紀錄；只有 loopResult 真的是
	// nil（一開始就失敗，例如 API key 無效）才整個放棄，chat 退回 pending 之後可以重送。
	if loopResult == nil {
		_ = repo.ReleaseChatToPending(chatID)
		return pending, loopErr
	}

	output := &AgenticQueryOutput{
		AgentID:       agent.ID,
		ChatID:        chatID,
		UserMessageID: userMessageID,
		ChatStatus:    storytellerModel.StoryChatStatusCompleted,
		RawResponses:  loopResult.RawResponses,
		Provider:      plan.Key.Provider,
		ModelName:     plan.ModelName,
		Result:        loopResult.FinalText,
		Steps:         loopResult.Steps,
		Proposals:     buildAgentProposalRows(ExtractProposals(loopResult, writeToolNames)),
		Usage:         loopResult.Usage,
	}
	assistantMessage := agenticQueryAssistantMessage(agent, output, ignoreAgentPersona)
	usage := buildAgenticQueryUsageLog(repo, userID, plan.Key.ID, output)
	if err := repo.CompleteChatMessage(chatID, assistantMessage, output.Proposals, usage); err != nil {
		_ = repo.ReleaseChatToPending(chatID)
		return nil, err
	}
	output.AssistantMessageID = assistantMessage.ID
	return output, loopErr
}

// ---- skill（/rewrite、/expand、/translate、/continue、/custom）----

func (s *Service) RunAgent(ctx context.Context, userID uint64, projectPublicID, storyPublicID string, agentID uint64, input storytellerModel.AgentRunRequest) (*storytellerModel.AgentRunResponse, error) {
	return submitAgentSkill(s.submitDeps(), nil, userID, projectPublicID, agenticQueryCurrentTargetStory, storyPublicID, agentID, input)
}

func (s *Service) RunLoreAgent(ctx context.Context, userID uint64, projectPublicID, lorePublicID string, agentID uint64, input storytellerModel.AgentRunRequest) (*storytellerModel.AgentRunResponse, error) {
	return submitAgentSkill(s.submitDeps(), nil, userID, projectPublicID, agenticQueryCurrentTargetLore, lorePublicID, agentID, input)
}

func submitAgentSkill(deps agentSubmitDeps, readOnlyTools []ToolSpec, userID uint64, projectPublicID string, kind agenticQueryCurrentTargetKind, targetPublicID string, agentID uint64, input storytellerModel.AgentRunRequest) (*storytellerModel.AgentRunResponse, error) {
	if err := validateAgentRunRequest(input); err != nil {
		return nil, err
	}
	ack, err := submitAgentRun(deps, agentSubmitParams{
		UserID: userID, ProjectPublicID: projectPublicID, TargetKind: kind, TargetPublicID: targetPublicID, AgentID: agentID,
		ProviderAPIKeyID: input.ProviderAPIKeyID, ModelName: input.ModelName,
		TrackName: "storyteller.agent_run",
		Begin: func(plan *agentRunPlan) (*agentRunJob, error) {
			useLoop := agentRunShouldUseLoop(plan.Key.Provider, input)
			chat := newAgentChat(plan.Target, userID, plan.Agent.ID)
			userMessage := agentRunUserMessage(*plan.Agent, input)
			if err := deps.Repo.CreateInProgressChatWithUserMessage(chat, userMessage); err != nil {
				return nil, err
			}
			return &agentRunJob{ChatID: chat.ID, UserMessageID: userMessage.ID, Run: func(ctx context.Context) error {
				_, err := completeAgentRun(ctx, deps.Repo, plan, readOnlyTools, useLoop, input, chat.ID, userMessage.ID)
				return err
			}}, nil
		},
	})
	if err != nil {
		return nil, err
	}
	return &storytellerModel.AgentRunResponse{
		AgentID:       ack.AgentID,
		UserMessageID: ack.UserMessageID,
		ChatID:        ack.ChatID,
		ChatStatus:    storytellerModel.StoryChatStatusInProgress,
		Provider:      ack.Provider,
		ModelName:     ack.ModelName,
		Mode:          input.Mode,
	}, nil
}

// completeAgentRun 對稱於 completeAgenticQuery：呼叫失敗時把 chat 退回 pending。
func completeAgentRun(ctx context.Context, repo agentRunRepository, plan *agentRunPlan, readOnlyTools []ToolSpec, useLoop bool, input storytellerModel.AgentRunRequest, chatID, userMessageID uint64) (*storytellerModel.AgentRunResponse, error) {
	agent, userID := *plan.Agent, plan.UserID
	systemPrompt, userPrompt := buildAgentRunPrompts(agent, input, plan.ProjectPublicID, plan.Target, useLoop)
	result, err := executeAgentRun(ctx, plan.Provider, plan.APIKey, plan.ModelName, systemPrompt, userPrompt, plan.ProjectPublicID, readOnlyTools, useLoop, userID)
	if err != nil {
		_ = repo.ReleaseChatToPending(chatID)
		return nil, err
	}
	output := &storytellerModel.AgentRunResponse{
		AgentID:       agent.ID,
		UserMessageID: userMessageID,
		ChatID:        chatID,
		ChatStatus:    storytellerModel.StoryChatStatusCompleted,
		Provider:      plan.Key.Provider,
		ModelName:     plan.ModelName,
		Mode:          input.Mode,
		Result:        result.Text,
		FinishReason:  result.FinishReason,
	}
	if result.Usage != nil {
		output.Usage = &storytellerModel.AgentRunUsage{
			InputTokens:  result.Usage.InputTokens,
			OutputTokens: result.Usage.OutputTokens,
			TotalTokens:  result.Usage.TotalTokens,
		}
	}
	assistantMessage := agentRunAssistantMessage(agent, output, result.RawResponses)
	usage := buildAgentUsageLog(repo, userID, plan.Key.ID, output)
	if err := repo.CompleteChatMessage(chatID, assistantMessage, nil, usage); err != nil {
		_ = repo.ReleaseChatToPending(chatID)
		return nil, err
	}
	output.AssistantMessageID = assistantMessage.ID
	return output, nil
}
