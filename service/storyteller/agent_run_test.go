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
	start := 2
	end := 5

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
				SelectionStart:  &start,
				SelectionEnd:    &end,
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
				SelectionStart:  &start,
				SelectionEnd:    &end,
			},
		},
		{
			name: "chapter mode without instruction",
			input: storytellerModel.AgentRunRequest{
				Mode:        storytellerModel.AgentRunModeCustomChapter,
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
				Mode:        storytellerModel.AgentRunModeCustomChapter,
				Instruction: strings.Repeat("a", agentRunInstructionMaxRunes+1),
			},
			wantErr: "instruction must be 4000 characters or less",
		},
		{
			name: "full content too large",
			input: storytellerModel.AgentRunRequest{
				Mode:        storytellerModel.AgentRunModeCustomChapter,
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
				SelectionStart:  &start,
				SelectionEnd:    &end,
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
		{
			name: "selection range without content",
			input: storytellerModel.AgentRunRequest{
				Mode:           storytellerModel.AgentRunModeCustomSelection,
				Instruction:    "process selection",
				SelectionStart: &start,
				SelectionEnd:   &end,
			},
			wantErr: "selected_content is required when selection_start/selection_end is provided",
		},
		{
			name: "selection missing start",
			input: storytellerModel.AgentRunRequest{
				Mode:            storytellerModel.AgentRunModeCustomSelection,
				Instruction:     "process selection",
				SelectedContent: "old",
				SelectionEnd:    &end,
			},
			wantErr: "selection_start is required",
		},
		{
			name: "selection missing end",
			input: storytellerModel.AgentRunRequest{
				Mode:            storytellerModel.AgentRunModeCustomSelection,
				Instruction:     "process selection",
				SelectedContent: "old",
				SelectionStart:  &start,
			},
			wantErr: "selection_end is required",
		},
		{
			name: "selection end before start",
			input: storytellerModel.AgentRunRequest{
				Mode:            storytellerModel.AgentRunModeCustomSelection,
				Instruction:     "process selection",
				SelectedContent: "old",
				SelectionStart:  &end,
				SelectionEnd:    &start,
			},
			wantErr: "selection_end must be greater than selection_start",
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
	start := 0
	end := 5
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

	output, err := runAgent(context.Background(), repo, func(agentProvider storytellerModel.AgentProvider, endpoint string) (AIProvider, error) {
		require.Equal(t, storytellerModel.AgentProviderGrok, agentProvider)
		return provider, nil
	}, 20, "project-public-id", "story-public-id", 40, storytellerModel.AgentRunRequest{
		Mode:            storytellerModel.AgentRunModeRewriteSelection,
		Instruction:     "rewrite",
		FullContent:     "full chapter",
		SelectedContent: "scene",
		SelectionStart:  &start,
		SelectionEnd:    &end,
	})

	require.NoError(t, err)
	require.Equal(t, uint64(40), output.AgentID)
	require.Equal(t, storytellerModel.AgentProviderGrok, output.Provider)
	require.Equal(t, "grok-test", output.ModelName)
	require.Equal(t, storytellerModel.AgentRunModeRewriteSelection, output.Mode)
	require.Equal(t, "rewritten text", output.Result)
	require.Equal(t, "stop", output.FinishReason)
	require.Equal(t, 11, output.Usage.InputTokens)
	require.Equal(t, "secret-key", provider.request.APIKey)
	require.Equal(t, "grok-test", provider.request.ModelName)
	require.Contains(t, provider.request.SystemPrompt, "Use concise prose.")
	require.Contains(t, provider.request.UserPrompt, "Current selected text (a focus hint, not the only editable scope):")
	require.Contains(t, provider.request.UserPrompt, "Output requirements:")
	require.NotNil(t, repo.chat)
	require.NotNil(t, repo.chat.StoryID)
	require.Equal(t, uint64(30), *repo.chat.StoryID)
	require.Equal(t, uint64(40), repo.chat.AgentID)
	require.Equal(t, uint64(20), repo.chat.UserID)
	require.Len(t, repo.messages, 2)
	require.Equal(t, storytellerModel.ChatMessageRoleUser, repo.messages[0].Role)
	require.Equal(t, "> scene\n\nrewrite", repo.messages[0].Content)
	require.Equal(t, storytellerModel.ChatMessageRoleAssistant, repo.messages[1].Role)
	require.Equal(t, "rewritten text", repo.messages[1].Content)
	require.NotNil(t, repo.usage)
	require.Equal(t, uint64(50), repo.usage.ProviderAPIKeyID)
	require.Equal(t, uint64(40), repo.usage.AgentID)
	require.Equal(t, uint64(20), repo.usage.UserID)
	require.Equal(t, 11, repo.usage.InputTokens)
	require.Equal(t, 7, repo.usage.OutputTokens)
	require.Equal(t, 18, repo.usage.TotalTokens)
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

	output, err := runAgent(context.Background(), repo, func(agentProvider storytellerModel.AgentProvider, endpoint string) (AIProvider, error) {
		// 一定是覆寫 key 自己的 provider（Claude），不是 Agent 記錄的 Grok。
		require.Equal(t, storytellerModel.AgentProviderClaude, agentProvider)
		return provider, nil
	}, 20, "project-public-id", "story-public-id", 40, storytellerModel.AgentRunRequest{
		Mode:             storytellerModel.AgentRunModeCustomChapter,
		Instruction:      "rewrite with claude instead",
		FullContent:      "full chapter",
		ProviderAPIKeyID: &overrideKeyID,
		ModelName:        "claude-override-model",
	})

	require.NoError(t, err)
	require.Equal(t, "override-secret-key", provider.request.APIKey)
	require.Equal(t, "claude-override-model", provider.request.ModelName)
	require.Equal(t, storytellerModel.AgentProviderClaude, output.Provider)
	require.Equal(t, "claude-override-model", output.ModelName)
}

func TestRunAgentStoryNotFound(t *testing.T) {
	repo := &fakeAgentRunRepository{
		project:  &storytellerModel.Project{ID: 10, UserID: 20, PublicID: "project-public-id"},
		storyErr: gorm.ErrRecordNotFound,
	}

	output, err := runAgent(context.Background(), repo, nil, 20, "project-public-id", "story-public-id", 40, storytellerModel.AgentRunRequest{
		Mode:        storytellerModel.AgentRunModeCustomChapter,
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

	output, err := runAgent(context.Background(), repo, nil, 20, "project-public-id", "story-public-id", 40, storytellerModel.AgentRunRequest{
		Mode:        storytellerModel.AgentRunModeCustomChapter,
		Instruction: "analyze",
		FullContent: "full chapter",
	})

	require.Nil(t, output)
	require.ErrorIs(t, err, gorm.ErrRecordNotFound)
}

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

	output, err := runAgent(context.Background(), repo, func(storytellerModel.AgentProvider, string) (AIProvider, error) {
		return &fakeAIProvider{err: providerErr}, nil
	}, 20, "project-public-id", "story-public-id", 40, storytellerModel.AgentRunRequest{
		Mode:        storytellerModel.AgentRunModeCustomChapter,
		Instruction: "analyze",
		FullContent: "full chapter",
	})

	require.Nil(t, output)
	require.ErrorIs(t, err, providerErr)
}

type fakeAgentRunRepository struct {
	project           *storytellerModel.Project
	projectErr        error
	story             *storytellerModel.Story
	storyErr          error
	lore              *storytellerModel.Lore
	loreErr           error
	agent             *storytellerModel.Agent
	agentErr          error
	providerAPIKey    *storytellerModel.ProviderAPIKey
	providerAPIKeyErr error
	chat              *storytellerModel.StoryChat
	messages          []storytellerModel.StoryChatMessage
	proposals         []storytellerModel.AgentProposal
	usage             *storytellerModel.AgentUsageLog
	chatErr           error
	proposal          *storytellerModel.AgentProposal
	proposalErr       error
	updatedProposalID uint64
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
	r.chat = chat
	r.messages = messages
	r.proposals = proposals
	r.usage = usage
	return r.chatErr
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
