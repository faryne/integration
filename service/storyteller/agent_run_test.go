package storyteller

import (
	"context"
	"encoding/base64"
	"errors"
	"strings"
	"testing"
	"time"

	"faryne.dev/config"
	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/service/background"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

func init() {
	// 讓測試能實際跑加解密流程，而不是依賴已移除的明文 fallback。
	config.EnvConfig().StorytellerAgentAPIKeyActiveKeyID = "test"
	config.EnvConfig().StorytellerAgentAPIKeyMasterKeys = "test:" + base64.RawURLEncoding.EncodeToString(make([]byte, 32))
}

func encryptedTestProviderAPIKey(t *testing.T, id, userID uint64, provider storytellerModel.AgentProvider, plaintext string) *storytellerModel.ProviderAPIKey {
	t.Helper()
	key := &storytellerModel.ProviderAPIKey{ID: id, UserID: userID, Provider: provider}
	require.NoError(t, applyEncryptedProviderAPIKey(key, plaintext))
	return key
}

func TestValidateAgentRunRequest(t *testing.T) {
	tests := []struct {
		name    string
		input   storytellerModel.AgentRunRequest
		wantErr string
	}{
		{
			name: "selection mode",
			input: storytellerModel.AgentRunRequest{
				Mode:            storytellerModel.AgentRunModeRewriteSelection,
				Instruction:     "rewrite with more suspense",
				SelectedContent: "old",
			},
		},
		{
			name: "chapter mode",
			input: storytellerModel.AgentRunRequest{
				Mode:        storytellerModel.AgentRunModeContinueChapter,
				Instruction: "continue the next paragraph",
				FullContent: "chapter",
			},
		},
		{
			name: "selection mode without instruction",
			input: storytellerModel.AgentRunRequest{
				Mode:            storytellerModel.AgentRunModeRewriteSelection,
				SelectedContent: "old",
			},
		},
		{
			name: "chapter mode without instruction",
			input: storytellerModel.AgentRunRequest{
				Mode:        storytellerModel.AgentRunModeContinueChapter,
				FullContent: "chapter",
			},
		},
		{
			name: "invalid mode",
			input: storytellerModel.AgentRunRequest{
				Mode:        storytellerModel.AgentRunMode("unknown"),
				Instruction: "test",
			},
			wantErr: "invalid mode",
		},
		{
			name: "instruction too large",
			input: storytellerModel.AgentRunRequest{
				Mode:        storytellerModel.AgentRunModeContinueChapter,
				Instruction: strings.Repeat("a", agentRunInstructionMaxRunes+1),
			},
			wantErr: "instruction must be 4000 characters or less",
		},
		{
			name: "full content too large",
			input: storytellerModel.AgentRunRequest{
				Mode:        storytellerModel.AgentRunModeContinueChapter,
				Instruction: "process",
				FullContent: strings.Repeat("a", agentRunFullContentMaxRunes+1),
			},
			wantErr: "full_content must be 60000 characters or less",
		},
		{
			name: "selected content too large",
			input: storytellerModel.AgentRunRequest{
				Mode:            storytellerModel.AgentRunModeCustomSelection,
				Instruction:     "process",
				SelectedContent: strings.Repeat("a", agentRunSelectedContentMaxRunes+1),
			},
			wantErr: "selected_content must be 20000 characters or less",
		},
		{
			name: "selection mode without any selection falls back to full-content context",
			input: storytellerModel.AgentRunRequest{
				Mode:        storytellerModel.AgentRunModeCustomSelection,
				Instruction: "process without selecting text",
				FullContent: "full chapter",
			},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			err := validateAgentRunRequest(tt.input)
			if tt.wantErr == "" {
				require.NoError(t, err)
				return
			}
			require.EqualError(t, err, tt.wantErr)
		})
	}
}

func TestRunAgent(t *testing.T) {
	providerAPIKeyID := uint64(50)
	repo := &fakeAgentRunRepository{
		project: &storytellerModel.Project{ID: 10, UserID: 20, PublicID: "project-public-id"},
		story:   &storytellerModel.Story{ID: 30, ProjectID: 10, PublicID: "story-public-id"},
		agent: &storytellerModel.Agent{
			ID:               40,
			UserID:           20,
			Provider:         storytellerModel.AgentProviderGrok,
			ModelName:        "grok-test",
			ProviderAPIKeyID: &providerAPIKeyID,
			DefaultPrompt:    "Use concise prose.",
		},
		providerAPIKey: encryptedTestProviderAPIKey(t, 50, 20, storytellerModel.AgentProviderGrok, "secret-key"),
	}
	provider := &fakeAIProvider{
		response: &AIProviderResponse{
			Result:       "rewritten text",
			FinishReason: "stop",
			Usage:        &AIProviderUsage{InputTokens: 11, OutputTokens: 7, TotalTokens: 18},
		},
	}

	tracker := background.NewTracker()
	output, err := runAgent(context.Background(), repo, func(agentProvider storytellerModel.AgentProvider, endpoint string) (AIProvider, error) {
		require.Equal(t, storytellerModel.AgentProviderGrok, agentProvider)
		return provider, nil
	}, tracker, 20, "project-public-id", "story-public-id", 40, storytellerModel.AgentRunRequest{
		Mode:            storytellerModel.AgentRunModeRewriteSelection,
		Instruction:     "rewrite",
		FullContent:     "full chapter",
		SelectedContent: "scene",
	})

	require.NoError(t, err)
	require.Equal(t, uint64(40), output.AgentID)
	require.Equal(t, storytellerModel.StoryChatStatusInProgress, output.ChatStatus)
	tracker.BeginDrain()
	tracker.Wait()

	require.Equal(t, "secret-key", provider.request.APIKey)
	require.Equal(t, "grok-test", provider.request.ModelName)
	require.Contains(t, provider.request.SystemPrompt, "Use concise prose.")
	require.Contains(t, provider.request.SystemPrompt, "Authorized project_public_id for this skill run: project-public-id")
	require.Contains(t, provider.request.UserPrompt, "User's current selected text from the editor")
	require.Contains(t, provider.request.UserPrompt, "Output requirements:")
	require.NotNil(t, repo.chat)
	require.NotNil(t, repo.chat.StoryID)
	require.Equal(t, uint64(30), *repo.chat.StoryID)
	require.Equal(t, uint64(40), repo.chat.AgentID)
	require.Equal(t, uint64(20), repo.chat.UserID)
	require.Equal(t, storytellerModel.StoryChatStatusCompleted, repo.chat.Status)
	require.Len(t, repo.messages, 2)
	require.Equal(t, storytellerModel.ChatMessageRoleUser, repo.messages[0].Role)
	require.Equal(t, "> scene\n\nrewrite", repo.messages[0].Content)
	require.JSONEq(t, `{"mode":"rewrite_selection","selected_content":"scene","selected_content_length":5,"full_content_length":12}`, repo.messages[0].Metadata)
	require.Equal(t, storytellerModel.ChatMessageRoleAssistant, repo.messages[1].Role)
	require.Equal(t, "rewritten text", repo.messages[1].Content)
	require.NotNil(t, repo.usage)
	require.Equal(t, uint64(50), repo.usage.ProviderAPIKeyID)
	require.Equal(t, uint64(20), repo.usage.UserID)
	require.Equal(t, 11, repo.usage.InputTokens)
	require.Equal(t, 7, repo.usage.OutputTokens)
	require.Equal(t, 18, repo.usage.TotalTokens)
}

func TestRunAgentWithReferenceCallsReadOnlyTool(t *testing.T) {
	providerAPIKeyID := uint64(50)
	repo := &fakeAgentRunRepository{
		project: &storytellerModel.Project{ID: 10, UserID: 20, PublicID: "project-public-id"},
		story:   &storytellerModel.Story{ID: 30, ProjectID: 10, PublicID: "story-public-id", Title: "目前故事"},
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
				require.Empty(t, req.UserPrompt)
				require.Len(t, req.Messages, 1)
				require.Empty(t, req.Messages[0].ToolCalls)
				require.Len(t, req.Tools, 1)
				require.Equal(t, "storyteller_get_story", req.Tools[0].Name)
				require.Contains(t, req.SystemPrompt, "Current story (what \"@thisStory\" refers to): story_public_id=story-public-id")
				require.Contains(t, req.Messages[0].Content, "Extra @ references available through read-only tools")
				require.Contains(t, req.Messages[0].Content, "Token: @story:[其他故事]")
				require.NotContains(t, req.Messages[0].Content, "這段引用全文不應該送進 provider")
				return &AIProviderResponse{
					ToolCalls: []ToolCall{{
						ID:   "toolu_1",
						Name: "storyteller_get_story",
						Arguments: map[string]interface{}{
							"project_public_id": "project-public-id",
							"story_public_id":   "other-story",
						},
					}},
					Usage:   &AIProviderUsage{InputTokens: 4, OutputTokens: 1, TotalTokens: 5},
					RawBody: `{"step":1}`,
				}, nil
			}
			require.Len(t, req.Messages, 3)
			require.Equal(t, "tool", req.Messages[2].Role)
			require.Contains(t, req.Messages[2].Content, "工具讀到的故事內容")
			return &AIProviderResponse{
				Result:       "整理後的文字",
				FinishReason: "end_turn",
				Usage:        &AIProviderUsage{InputTokens: 6, OutputTokens: 3, TotalTokens: 9},
				RawBody:      `{"step":2}`,
			}, nil
		},
	}
	toolCalled := false
	tools := []ToolSpec{{
		Name:        "storyteller_get_story",
		Description: "read story",
		Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
			toolCalled = true
			userID, err := storytellerUserIDFromContext(ctx)
			require.NoError(t, err)
			require.Equal(t, uint64(20), userID)
			require.Equal(t, "agent_skill", storytellerSourceFromContext(ctx))
			require.Equal(t, "project-public-id", arguments["project_public_id"])
			return map[string]string{"content": "工具讀到的故事內容"}, nil
		},
	}}

	tracker := background.NewTracker()
	output, err := runAgentWithTools(context.Background(), repo, func(storytellerModel.AgentProvider, string) (AIProvider, error) {
		return provider, nil
	}, tools, tracker, 20, "project-public-id", "story-public-id", 40, storytellerModel.AgentRunRequest{
		Mode:        storytellerModel.AgentRunModeCustomSelection,
		Instruction: "請參考 @story:[其他故事] 改寫語氣",
		FullContent: "Reference story: 其他故事\nToken: @story:[其他故事]\n<<<STORY_REFERENCE_CONTENT\n這段引用全文不應該送進 provider\nSTORY_REFERENCE_CONTENT",
	})

	require.NoError(t, err)
	require.Equal(t, storytellerModel.StoryChatStatusInProgress, output.ChatStatus)
	tracker.BeginDrain()
	tracker.Wait()

	require.True(t, toolCalled)
	require.Len(t, repo.messages, 2)
	require.Equal(t, "整理後的文字", repo.messages[1].Content)
	require.Contains(t, repo.messages[1].Metadata, `"finish_reason":"end_turn"`)
	require.NotNil(t, repo.messages[1].RawProviderResponse)
	require.JSONEq(t, `["{\"step\":1}","{\"step\":2}"]`, *repo.messages[1].RawProviderResponse)
	require.NotNil(t, repo.usage)
	require.Equal(t, 14, repo.usage.TotalTokens)
}

func TestRunAgentGeminiKeepsSingleGenerateEvenWithReference(t *testing.T) {
	providerAPIKeyID := uint64(50)
	repo := &fakeAgentRunRepository{
		project: &storytellerModel.Project{ID: 10, UserID: 20, PublicID: "project-public-id"},
		story:   &storytellerModel.Story{ID: 30, ProjectID: 10, PublicID: "story-public-id"},
		agent: &storytellerModel.Agent{
			ID:               40,
			UserID:           20,
			Provider:         storytellerModel.AgentProviderGemini,
			ModelName:        "gemini-test",
			ProviderAPIKeyID: &providerAPIKeyID,
		},
		providerAPIKey: encryptedTestProviderAPIKey(t, 50, 20, storytellerModel.AgentProviderGemini, "secret-key"),
	}
	provider := &fakeAIProvider{response: &AIProviderResponse{Result: "gemini result"}}

	tracker := background.NewTracker()
	output, err := runAgent(context.Background(), repo, func(agentProvider storytellerModel.AgentProvider, endpoint string) (AIProvider, error) {
		require.Equal(t, storytellerModel.AgentProviderGemini, agentProvider)
		return provider, nil
	}, tracker, 20, "project-public-id", "story-public-id", 40, storytellerModel.AgentRunRequest{
		Mode:        storytellerModel.AgentRunModeCustomSelection,
		Instruction: "請參考 @story:[其他故事]",
		FullContent: "Reference story: 其他故事\nToken: @story:[其他故事]\n<<<STORY_REFERENCE_CONTENT\n引用全文\nSTORY_REFERENCE_CONTENT",
	})

	require.NoError(t, err)
	require.Equal(t, storytellerModel.StoryChatStatusInProgress, output.ChatStatus)
	tracker.BeginDrain()
	tracker.Wait()

	require.Equal(t, "gemini result", repo.messages[1].Content)
	require.Empty(t, provider.request.Tools)
	require.Empty(t, provider.request.Messages)
	require.Contains(t, provider.request.UserPrompt, "引用全文")
}

// TestRunAgentProviderAPIKeyOverrideCanCrossProvider 驗證「Agent 只是人設/prompt，
// 這次要用哪把 key／哪個 model 是各自獨立的覆寫」——覆寫的 key 可以跟 Agent 記錄的
// provider 不一樣（這裡 Agent 設定的是 Grok，覆寫後改用一把 Claude 的 key），
// 這種情況不該被 errAgentProviderAPIKeyMismatch 擋下來，且實際呼叫 provider 跟
// 記錄下來的 output.Provider／ModelName 都要反映「這次真的用了什麼」，不是 Agent
// 的靜態預設值。
func TestRunAgentProviderAPIKeyOverrideCanCrossProvider(t *testing.T) {
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
			DefaultPrompt:    "Use concise prose.",
		},
		// mock 的 ProviderAPIKey() 不看傳入的 id，直接回傳這把——用來模擬「覆寫的
		// key id 解析出一把 provider 完全不同的 key」這個情境。
		providerAPIKey: encryptedTestProviderAPIKey(t, overrideKeyID, 20, storytellerModel.AgentProviderClaude, "override-secret-key"),
	}
	provider := &fakeAIProvider{
		response: &AIProviderResponse{
			Result:       "rewritten with claude",
			FinishReason: "stop",
			Usage:        &AIProviderUsage{InputTokens: 3, OutputTokens: 2, TotalTokens: 5},
		},
	}

	tracker := background.NewTracker()
	output, err := runAgent(context.Background(), repo, func(agentProvider storytellerModel.AgentProvider, endpoint string) (AIProvider, error) {
		// 一定是覆寫 key 自己的 provider（Claude），不是 Agent 記錄的 Grok。
		require.Equal(t, storytellerModel.AgentProviderClaude, agentProvider)
		return provider, nil
	}, tracker, 20, "project-public-id", "story-public-id", 40, storytellerModel.AgentRunRequest{
		Mode:             storytellerModel.AgentRunModeContinueChapter,
		Instruction:      "rewrite with claude instead",
		FullContent:      "full chapter",
		ProviderAPIKeyID: &overrideKeyID,
		ModelName:        "claude-override-model",
	})

	require.NoError(t, err)
	require.Equal(t, storytellerModel.AgentProviderClaude, output.Provider)
	require.Equal(t, "claude-override-model", output.ModelName)
	tracker.BeginDrain()
	tracker.Wait()

	require.Equal(t, "override-secret-key", provider.request.APIKey)
	require.Equal(t, "claude-override-model", provider.request.ModelName)
}

func TestRunAgentStoryNotFound(t *testing.T) {
	repo := &fakeAgentRunRepository{
		project:  &storytellerModel.Project{ID: 10, UserID: 20, PublicID: "project-public-id"},
		storyErr: gorm.ErrRecordNotFound,
	}

	output, err := runAgent(context.Background(), repo, nil, background.NewTracker(), 20, "project-public-id", "story-public-id", 40, storytellerModel.AgentRunRequest{
		Mode:        storytellerModel.AgentRunModeContinueChapter,
		Instruction: "analyze",
		FullContent: "full chapter",
	})

	require.Nil(t, output)
	require.ErrorIs(t, err, gorm.ErrRecordNotFound)
}

func TestRunAgentAgentNotFound(t *testing.T) {
	repo := &fakeAgentRunRepository{
		project:  &storytellerModel.Project{ID: 10, UserID: 20, PublicID: "project-public-id"},
		story:    &storytellerModel.Story{ID: 30, ProjectID: 10, PublicID: "story-public-id"},
		agentErr: gorm.ErrRecordNotFound,
	}

	output, err := runAgent(context.Background(), repo, nil, background.NewTracker(), 20, "project-public-id", "story-public-id", 40, storytellerModel.AgentRunRequest{
		Mode:        storytellerModel.AgentRunModeContinueChapter,
		Instruction: "analyze",
		FullContent: "full chapter",
	})

	require.Nil(t, output)
	require.ErrorIs(t, err, gorm.ErrRecordNotFound)
}

// TestRunAgentProviderError 驗證背景呼叫 provider 失敗時，chat 會退回 pending
// （見 completeAgentRun 的 ReleaseChatToPending），而不是讓使用者一直卡在
// 「還在處理中」——enqueue 本身不會因為背景失敗而回傳錯誤，跟 agentic query
// 的背景執行模型一致。
func TestRunAgentProviderError(t *testing.T) {
	providerErr := errors.New("provider failed")
	providerAPIKeyID := uint64(50)
	repo := &fakeAgentRunRepository{
		project: &storytellerModel.Project{ID: 10, UserID: 20, PublicID: "project-public-id"},
		story:   &storytellerModel.Story{ID: 30, ProjectID: 10, PublicID: "story-public-id"},
		agent: &storytellerModel.Agent{
			ID:               40,
			UserID:           20,
			Provider:         storytellerModel.AgentProviderGrok,
			ModelName:        "grok-test",
			ProviderAPIKeyID: &providerAPIKeyID,
		},
		providerAPIKey: encryptedTestProviderAPIKey(t, 50, 20, storytellerModel.AgentProviderGrok, "secret-key"),
	}

	tracker := background.NewTracker()
	output, err := runAgent(context.Background(), repo, func(storytellerModel.AgentProvider, string) (AIProvider, error) {
		return &fakeAIProvider{err: providerErr}, nil
	}, tracker, 20, "project-public-id", "story-public-id", 40, storytellerModel.AgentRunRequest{
		Mode:        storytellerModel.AgentRunModeContinueChapter,
		Instruction: "analyze",
		FullContent: "full chapter",
	})

	require.NoError(t, err)
	require.Equal(t, storytellerModel.StoryChatStatusInProgress, output.ChatStatus)
	tracker.BeginDrain()
	tracker.Wait()

	require.True(t, repo.released)
	require.Len(t, repo.messages, 1)
}

type fakeAgentRunRepository struct {
	project          *storytellerModel.Project
	projectErr       error
	story            *storytellerModel.Story
	storyErr         error
	lore             *storytellerModel.Lore
	loreErr          error
	agent            *storytellerModel.Agent
	agentErr         error
	agentsByID       []storytellerModel.Agent
	agentsByIDErr    error
	agentsByIDLookup struct {
		userID uint64
		ids    []uint64
	}
	providerAPIKey        *storytellerModel.ProviderAPIKey
	providerAPIKeyErr     error
	chat                  *storytellerModel.StoryChat
	messages              []storytellerModel.StoryChatMessage
	proposals             []storytellerModel.AgentProposal
	usage                 *storytellerModel.AgentUsageLog
	chatErr               error
	proposal              *storytellerModel.AgentProposal
	proposalErr           error
	updatedProposalID     uint64
	historyMessages       []storytellerModel.StoryChatMessage
	historyErr            error
	claimResult           int64
	claimErr              error
	released              bool
	pendingUserMessage    *storytellerModel.StoryChatMessage
	pendingUserMessageErr error
	storyMessage          *storytellerModel.StoryChatMessage
	storyMessageErr       error
	storyMessageLookup    struct{ userID, storyID, messageID uint64 }
	loreMessage           *storytellerModel.StoryChatMessage
	loreMessageErr        error
	loreMessageLookup     struct{ userID, loreID, messageID uint64 }
	projectProposal       *storytellerModel.AgentProposal
	projectProposalErr    error
	projectProposalLookup struct {
		userID, projectID uint64
		publicID          string
	}
}

func (r *fakeAgentRunRepository) ProjectByPublicIDForUser(uint64, string) (*storytellerModel.Project, error) {
	return r.project, r.projectErr
}

func (r *fakeAgentRunRepository) Story(uint64, string) (*storytellerModel.Story, error) {
	return r.story, r.storyErr
}

func (r *fakeAgentRunRepository) Lore(uint64, string) (*storytellerModel.Lore, error) {
	return r.lore, r.loreErr
}

func (r *fakeAgentRunRepository) Agent(uint64, uint64) (*storytellerModel.Agent, error) {
	return r.agent, r.agentErr
}

func (r *fakeAgentRunRepository) AgentsByIDs(userID uint64, ids []uint64) ([]storytellerModel.Agent, error) {
	r.agentsByIDLookup.userID = userID
	r.agentsByIDLookup.ids = append([]uint64(nil), ids...)
	return r.agentsByID, r.agentsByIDErr
}

func (r *fakeAgentRunRepository) ProviderAPIKey(uint64, uint64) (*storytellerModel.ProviderAPIKey, error) {
	return r.providerAPIKey, r.providerAPIKeyErr
}

func (r *fakeAgentRunRepository) AgentProposalByPublicIDForUser(uint64, string) (*storytellerModel.AgentProposal, error) {
	return r.proposal, r.proposalErr
}

func (r *fakeAgentRunRepository) UpdateAgentProposalStatus(id uint64, status storytellerModel.AgentProposalStatus, appliedAt *time.Time) (int64, error) {
	r.updatedProposalID = id
	if r.proposal != nil {
		r.proposal.Status = status
		r.proposal.AppliedAt = appliedAt
	}
	return 1, nil
}

func (r *fakeAgentRunRepository) ResetAppliedAgentProposalToPending(id uint64) (int64, error) {
	r.updatedProposalID = id
	if r.proposal != nil {
		r.proposal.Status = storytellerModel.AgentProposalStatusPending
		r.proposal.AppliedAt = nil
	}
	return 1, nil
}

func (r *fakeAgentRunRepository) CreateStoryChatWithMessages(chat *storytellerModel.StoryChat, messages []storytellerModel.StoryChatMessage, proposals []storytellerModel.AgentProposal, usage *storytellerModel.AgentUsageLog) error {
	if chat.ID == 0 {
		chat.ID = 1
	}
	for i := range messages {
		if messages[i].ID == 0 {
			messages[i].ID = uint64(1001 + i)
		}
		messages[i].ChatID = chat.ID
	}
	r.chat = chat
	r.messages = messages
	r.proposals = proposals
	r.usage = usage
	return r.chatErr
}

// CreateInProgressChatWithUserMessage／CompleteChatMessage 是新的兩段式寫入（見
// 同名的真實 Repository 方法）；假 repo 把兩段的結果合併回同一組 chat／messages
// 欄位，讓既有測試斷言（repo.chat／repo.messages 長度 2／repo.usage）不用跟著改。
func (r *fakeAgentRunRepository) CreateInProgressChatWithUserMessage(chat *storytellerModel.StoryChat, userMessage *storytellerModel.StoryChatMessage) error {
	if chat.ID == 0 {
		chat.ID = 1
	}
	chat.Status = storytellerModel.StoryChatStatusInProgress
	userMessage.ChatID = chat.ID
	if userMessage.ID == 0 {
		userMessage.ID = 1001
	}
	r.chat = chat
	r.messages = []storytellerModel.StoryChatMessage{*userMessage}
	return r.chatErr
}

func (r *fakeAgentRunRepository) CompleteChatMessage(chatID uint64, assistantMessage *storytellerModel.StoryChatMessage, proposals []storytellerModel.AgentProposal, usage *storytellerModel.AgentUsageLog) error {
	assistantMessage.ChatID = chatID
	if assistantMessage.ID == 0 {
		assistantMessage.ID = 1002
	}
	r.messages = append(r.messages, *assistantMessage)
	r.proposals = proposals
	r.usage = usage
	if r.chat != nil {
		r.chat.Status = storytellerModel.StoryChatStatusCompleted
	}
	return r.chatErr
}

func (r *fakeAgentRunRepository) ClaimStoryChatForResend(userID, storyID, chatID uint64) (int64, error) {
	return r.claimResult, r.claimErr
}

func (r *fakeAgentRunRepository) ClaimLoreChatForResend(userID, loreID, chatID uint64) (int64, error) {
	return r.claimResult, r.claimErr
}

func (r *fakeAgentRunRepository) ReleaseChatToPending(chatID uint64) error {
	r.released = true
	return nil
}

func (r *fakeAgentRunRepository) ChatUserMessage(chatID uint64) (*storytellerModel.StoryChatMessage, error) {
	return r.pendingUserMessage, r.pendingUserMessageErr
}

func (r *fakeAgentRunRepository) StoryChatMessageByIDForUserStory(userID, storyID, messageID uint64) (*storytellerModel.StoryChatMessage, error) {
	r.storyMessageLookup = struct{ userID, storyID, messageID uint64 }{userID: userID, storyID: storyID, messageID: messageID}
	return r.storyMessage, r.storyMessageErr
}

func (r *fakeAgentRunRepository) LoreChatMessageByIDForUserLore(userID, loreID, messageID uint64) (*storytellerModel.StoryChatMessage, error) {
	r.loreMessageLookup = struct{ userID, loreID, messageID uint64 }{userID: userID, loreID: loreID, messageID: messageID}
	return r.loreMessage, r.loreMessageErr
}

func (r *fakeAgentRunRepository) AgentProposalByPublicIDForUserProject(userID, projectID uint64, publicID string) (*storytellerModel.AgentProposal, error) {
	r.projectProposalLookup = struct {
		userID, projectID uint64
		publicID          string
	}{userID: userID, projectID: projectID, publicID: publicID}
	if r.projectProposal != nil || r.projectProposalErr != nil {
		return r.projectProposal, r.projectProposalErr
	}
	return r.proposal, r.proposalErr
}

func (r *fakeAgentRunRepository) RecentStoryAgenticMessages(uint64, int) ([]storytellerModel.StoryChatMessage, error) {
	return r.historyMessages, r.historyErr
}

func (r *fakeAgentRunRepository) RecentLoreAgenticMessages(uint64, int) ([]storytellerModel.StoryChatMessage, error) {
	return r.historyMessages, r.historyErr
}

func (r *fakeAgentRunRepository) AgentModelPrice(storytellerModel.AgentProvider, string) (*string, error) {
	return nil, nil
}

type fakeAIProvider struct {
	request  AIProviderRequest
	response *AIProviderResponse
	err      error
}

func (p *fakeAIProvider) Generate(_ context.Context, req AIProviderRequest) (*AIProviderResponse, error) {
	p.request = req
	return p.response, p.err
}
