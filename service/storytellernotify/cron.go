package storytellernotify

import (
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/service/log"
	auditService "faryne.dev/service/storytelleraudit"
	"go.uber.org/zap"
)

// RunPurgeExpiredNotifications 每日清除超過保留期且未鎖定的通知，並記一筆 system 稽核摘要。
func RunPurgeExpiredNotifications() {
	startedAt := time.Now()
	purged, err := NewService().Purge()
	summary := storytellerModel.AuditSummary{"purged": purged, "duration_ms": time.Since(startedAt).Milliseconds()}
	outcome := storytellerModel.AuditOutcomeSuccess
	if err != nil {
		outcome, summary["error_category"] = storytellerModel.AuditOutcomeFailed, "internal"
	}
	if emitErr := auditService.EmitSystem(auditService.EventInput{Action: "system.notification.purge", Outcome: outcome, Summary: summary}); emitErr != nil {
		log.Logger().Error("Emit storyteller notification purge audit failed", zap.Error(emitErr))
	}
	if err != nil {
		log.Logger().Error("Storyteller notification purge failed", zap.Error(err))
		return
	}
	log.Logger().Info("Storyteller notification purge completed", zap.Int64("purged", purged))
}
