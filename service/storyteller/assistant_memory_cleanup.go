package storyteller

import (
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/service/log"
	"go.uber.org/zap"
)

const (
	assistantMemoryDraftRetention = 7 * 24 * time.Hour
	assistantMemoryTrashRetention = 30 * 24 * time.Hour
)

type assistantMemoryDraftCleanupRepository interface {
	ExpireAssistantMemoryDrafts(updatedBefore, deletedAt time.Time) (int64, error)
	PurgeDeletedAssistantMemoryDrafts(deletedBefore time.Time) (int64, error)
}

func cleanupExpiredAssistantMemoryDrafts(repo assistantMemoryDraftCleanupRepository, now time.Time) (expired, purged int64, err error) {
	expired, err = repo.ExpireAssistantMemoryDrafts(now.Add(-assistantMemoryDraftRetention), now)
	if err != nil {
		return 0, 0, err
	}
	purged, err = repo.PurgeDeletedAssistantMemoryDrafts(now.Add(-assistantMemoryTrashRetention))
	return expired, purged, err
}

// RunCleanupAssistantMemoryDrafts 每日先 soft delete 逾期未確認草稿，再實體清除
// 已進垃圾區超過保留期的草稿；confirmed 記憶不會進入任一清理條件。
func RunCleanupAssistantMemoryDrafts() {
	startedAt := time.Now()
	expired, purged, err := cleanupExpiredAssistantMemoryDrafts(NewService().repo, time.Now())
	emitStorytellerCronAudit("system.memory_draft.cleanup", startedAt, storytellerModel.AuditSummary{"expired": expired, "purged": purged}, err)
	if err != nil {
		log.Logger().Error("Storyteller assistant memory draft cleanup failed", zap.Error(err))
		return
	}
	log.Logger().Info("Storyteller assistant memory draft cleanup completed", zap.Int64("expired", expired), zap.Int64("purged", purged))
}
