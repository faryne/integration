package storyteller

import (
	"context"
	"errors"
	"strings"
	"testing"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"github.com/stretchr/testify/require"
	"gorm.io/gorm"
)

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
			name: "selection missing content",
			input: storytellerModel.AgentRunRequest{
				Mode:           storytellerModel.AgentRunModeCustomSelection,
				Instruction:    "process selection",
				SelectionStart: &start,
				SelectionEnd:   &end,
			},
			wantErr: "selected_content is required",
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
		providerAPIKey: &storytellerModel.ProviderAPIKey{
			ID:       50,
			UserID:   20,
			Provider: storytellerModel.AgentProviderGrok,
			APIKey:   "secret-key",
		},
	}
	provider := &fakeAIProvider{
		response: &AIProviderResponse{
			Result:       "rewritten text",
			FinishReason: "stop",
			Usage:        &AIProviderUsage{InputTokens: 11, OutputTokens: 7, TotalTokens: 18},
		},
	}

	output, err := runAgent(context.Background(), repo, func(agentProvider storytellerModel.AgentProvider) (AIProvider, error) {
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
	require.Contains(t, provider.request.UserPrompt, "Current selected text:")
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
		providerAPIKey: &storytellerModel.ProviderAPIKey{
			ID:       50,
			UserID:   20,
			Provider: storytellerModel.AgentProviderGrok,
			APIKey:   "secret-key",
		},
	}

	output, err := runAgent(context.Background(), repo, func(storytellerModel.AgentProvider) (AIProvider, error) {
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
	agent             *storytellerModel.Agent
	agentErr          error
	providerAPIKey    *storytellerModel.ProviderAPIKey
	providerAPIKeyErr error
	chat              *storytellerModel.StoryChat
	messages          []storytellerModel.StoryChatMessage
	chatErr           error
}

func (r *fakeAgentRunRepository) ProjectByPublicIDForUser(uint64, string) (*storytellerModel.Project, error) {
	return r.project, r.projectErr
}

func (r *fakeAgentRunRepository) Story(uint64, string) (*storytellerModel.Story, error) {
	return r.story, r.storyErr
}

func (r *fakeAgentRunRepository) Agent(uint64, uint64) (*storytellerModel.Agent, error) {
	return r.agent, r.agentErr
}

func (r *fakeAgentRunRepository) ProviderAPIKey(uint64, uint64) (*storytellerModel.ProviderAPIKey, error) {
	return r.providerAPIKey, r.providerAPIKeyErr
}

func (r *fakeAgentRunRepository) CreateStoryChatWithMessages(chat *storytellerModel.StoryChat, messages []storytellerModel.StoryChatMessage) error {
	r.chat = chat
	r.messages = messages
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
