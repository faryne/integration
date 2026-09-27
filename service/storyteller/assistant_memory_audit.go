package storyteller

import (
	"context"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/service/log"
	auditService "faryne.dev/service/storytelleraudit"
	"go.uber.org/zap"
)

func emitMemoryDraftAudit(deps assistantMemoryGenerationDeps, projectID uint64, memoryPublicID string, chatID uint64, provider storytellerModel.AgentProvider, modelName string, usage *storytellerModel.AgentRunUsage, runErr error) {
	if deps.AuditEmitter == nil || deps.AuditAction == "" {
		return
	}
	outcome := storytellerModel.AuditOutcomeSuccess
	if runErr != nil {
		outcome = storytellerModel.AuditOutcomeFailed
	}
	summary := storytellerModel.AuditSummary{
		"chat_id": chatID, "provider": provider, "model": modelName, "input_tokens": 0, "output_tokens": 0,
	}
	if usage != nil {
		summary["input_tokens"], summary["output_tokens"] = usage.InputTokens, usage.OutputTokens
	}
	if err := deps.AuditEmitter(auditService.WithRequestContext(context.Background(), deps.AuditContext), auditService.EventInput{
		Action: deps.AuditAction, Outcome: outcome, ProjectID: &projectID,
		TargetType: "memory", TargetPublicID: memoryPublicID, Summary: summary,
	}); err != nil {
		log.Logger().Error("Emit storyteller memory draft audit event failed", zap.String("memory_public_id", memoryPublicID), zap.Error(err))
	}
}
