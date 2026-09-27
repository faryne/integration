package storyteller

import (
	"context"
	"strconv"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/service/log"
	auditService "faryne.dev/service/storytelleraudit"
	"go.uber.org/zap"
)

func emitAgentRunAudit(deps agentSubmitDeps, action string, plan *agentRunPlan, chatID uint64, usage *storytellerModel.AgentRunUsage, runErr error) {
	if deps.AuditEmitter == nil || action == "" {
		return
	}
	outcome := storytellerModel.AuditOutcomeSuccess
	if runErr != nil {
		outcome = storytellerModel.AuditOutcomeFailed
	}
	summary := storytellerModel.AuditSummary{
		"chat_id": chatID, "provider": plan.Key.Provider, "model": plan.ModelName,
		"input_tokens": 0, "output_tokens": 0,
	}
	if usage != nil {
		summary["input_tokens"], summary["output_tokens"] = usage.InputTokens, usage.OutputTokens
	}
	if err := deps.AuditEmitter(auditService.WithRequestContext(context.Background(), deps.AuditContext), auditService.EventInput{
		Action: action, Outcome: outcome, ProjectID: &plan.Project.ID, TargetType: "agent_chat",
		TargetPublicID: strconv.FormatUint(chatID, 10), Summary: summary,
	}); err != nil {
		log.Logger().Error("Emit storyteller agent audit event failed", zap.Uint64("chat_id", chatID), zap.Error(err))
	}
}

func agentAuditUsage(usage *AIProviderUsage) *storytellerModel.AgentRunUsage {
	if usage == nil {
		return nil
	}
	return &storytellerModel.AgentRunUsage{InputTokens: usage.InputTokens, OutputTokens: usage.OutputTokens, TotalTokens: usage.TotalTokens}
}
