package storyteller

import (
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/service/log"
	auditService "faryne.dev/service/storytelleraudit"
	"go.uber.org/zap"
)

// emitStorytellerCronAudit 每次 cron run 只送一筆摘要，不逐筆記錄受影響資料。
func emitStorytellerCronAudit(action string, startedAt time.Time, summary storytellerModel.AuditSummary, runErr error) {
	if summary == nil {
		summary = storytellerModel.AuditSummary{}
	}
	summary["duration_ms"] = time.Since(startedAt).Milliseconds()
	outcome := storytellerModel.AuditOutcomeSuccess
	if runErr != nil {
		outcome = storytellerModel.AuditOutcomeFailed
		summary["error_category"] = "internal"
	}
	if err := auditService.EmitSystem(auditService.EventInput{Action: action, Outcome: outcome, Summary: summary}); err != nil {
		log.Logger().Error("Emit storyteller cron audit event failed", zap.String("action", action), zap.Error(err))
	}
}
