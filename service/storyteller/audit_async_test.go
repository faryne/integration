package storyteller

import (
	"context"
	"errors"
	"testing"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/service/background"
	auditService "faryne.dev/service/storytelleraudit"
	"github.com/stretchr/testify/require"
)

func TestSubmitAgentRunCapturesRequestContextUntilBackgroundCompletion(t *testing.T) {
	captured := auditService.RequestContext{
		RequestID: "request-background", Source: storytellerModel.AuditSourceWeb,
		AuthMethod: storytellerModel.AuditAuthMethodSession, ActorUserID: 20,
	}
	repo := &fakeAgentRunRepository{
		project: &storytellerModel.Project{ID: 10, UserID: 20, PublicID: "project-public-id"},
		story:   &storytellerModel.Story{ID: 30, ProjectID: 10, PublicID: "story-public-id"},
		providerAPIKey: encryptedTestProviderAPIKey(
			t, 50, 20, storytellerModel.AgentProviderOpenAI, "secret-key",
		),
	}
	tracker := background.NewTracker()
	var emitted auditService.EventInput
	var runContext auditService.RequestContext
	deps := agentSubmitDeps{
		Repo: repo, Work: tracker,
		ProviderFactory: func(storytellerModel.AgentProvider, string) (AIProvider, error) { return &fakeAIProvider{}, nil },
		AuditContext:    captured,
		AuditEmitter:    func(_ context.Context, input auditService.EventInput) error { emitted = input; return nil },
	}
	keyID := uint64(50)
	_, err := submitAgentRun(deps, agentSubmitParams{
		UserID: 20, ProjectPublicID: "project-public-id", TargetKind: agenticQueryCurrentTargetStory,
		TargetPublicID: "story-public-id", ProviderAPIKeyID: &keyID, ModelName: "gpt-test",
		TrackName: "audit-test", AuditAction: "agent.run",
		Begin: func(*agentRunPlan) (*agentRunJob, error) {
			return &agentRunJob{ChatID: 99, Run: func(ctx context.Context) (*storytellerModel.AgentRunUsage, error) {
				runContext, _ = auditService.RequestContextFrom(ctx)
				return &storytellerModel.AgentRunUsage{InputTokens: 3, OutputTokens: 2}, nil
			}}, nil
		},
	})
	require.NoError(t, err)
	tracker.BeginDrain()
	tracker.Wait()

	require.Equal(t, captured, runContext)
	require.Equal(t, "agent.run", emitted.Action)
	require.Equal(t, 3, emitted.Summary["input_tokens"])
}

func TestAgentRunAuditUsesCapturedRequestContextAndUsage(t *testing.T) {
	captured := auditService.RequestContext{
		RequestID: "request-1", Source: storytellerModel.AuditSourceWeb,
		AuthMethod: storytellerModel.AuditAuthMethodSession, ActorUserID: 7,
	}
	var emitted auditService.EventInput
	var emittedContext auditService.RequestContext
	deps := agentSubmitDeps{AuditContext: captured, AuditEmitter: func(ctx context.Context, input auditService.EventInput) error {
		emitted = input
		emittedContext, _ = auditService.RequestContextFrom(ctx)
		return nil
	}}
	plan := &agentRunPlan{
		Project: &storytellerModel.Project{ID: 42}, Key: &storytellerModel.ProviderAPIKey{Provider: storytellerModel.AgentProviderOpenAI}, ModelName: "gpt-test",
	}
	emitAgentRunAudit(deps, "agent.run", plan, 99, &storytellerModel.AgentRunUsage{InputTokens: 12, OutputTokens: 8}, nil)

	require.Equal(t, captured, emittedContext)
	require.Equal(t, "agent.run", emitted.Action)
	require.Equal(t, storytellerModel.AuditOutcomeSuccess, emitted.Outcome)
	require.Equal(t, 12, emitted.Summary["input_tokens"])
	require.Equal(t, "99", emitted.TargetPublicID)
}

func TestMemoryDraftAuditEmitsFailedOutcomeWithoutContent(t *testing.T) {
	var emitted auditService.EventInput
	deps := assistantMemoryGenerationDeps{
		AuditAction:  "memory.draft.generate",
		AuditContext: auditService.RequestContext{RequestID: "request-2", Source: storytellerModel.AuditSourceWeb},
		AuditEmitter: func(_ context.Context, input auditService.EventInput) error { emitted = input; return nil },
	}
	emitMemoryDraftAudit(deps, 42, "memory-1", 99, storytellerModel.AgentProviderClaude, "claude-test", nil, errors.New("provider failed"))

	require.Equal(t, storytellerModel.AuditOutcomeFailed, emitted.Outcome)
	require.Equal(t, uint64(99), emitted.Summary["chat_id"])
	require.NotContains(t, emitted.Summary, "content")
}
