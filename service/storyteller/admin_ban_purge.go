package storyteller

import (
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/service/log"
	"go.uber.org/zap"
)

// bannedAccountPurgeAfter 是停權後保留內容的期間：停權當下不動內容（誤停權只要改回帳號狀態），
// 超過這段時間由每日排程把帳號下仍未刪除的作品、筆名、動態、討論串、留言以停權理由 soft delete。
const bannedAccountPurgeAfter = 6 * 30 * 24 * time.Hour

// RunPurgeBannedAccounts 是每日排程入口。
func RunPurgeBannedAccounts() {
	startedAt := time.Now()
	summary, err := NewService().purgeBannedAccounts(startedAt.Add(-bannedAccountPurgeAfter))
	emitStorytellerCronAudit("system.banned_account.purge", startedAt, summary, err)
	if err != nil {
		log.Logger().Error("Storyteller banned account purge failed", zap.Error(err))
		return
	}
	log.Logger().Info("Storyteller banned account purge completed", zap.Any("summary", summary))
}

// purgeBannedAccounts 冪等：只處理仍未刪除的內容，已清過的帳號重跑不會有任何變動。
func (s *Service) purgeBannedAccounts(cutoff time.Time) (storytellerModel.AuditSummary, error) {
	users, err := s.repo.BannedUsersBefore(cutoff)
	if err != nil {
		return nil, err
	}
	// totals 累計各類處理筆數，最後放進稽核摘要
	totals := map[string]int64{}
	summary := func() storytellerModel.AuditSummary {
		out := storytellerModel.AuditSummary{"accounts": len(users)}
		for name, count := range totals {
			out[name] = count
		}
		return out
	}
	for _, user := range users {
		projects, err := s.repo.LiveProjectsByUser(user.ID)
		if err != nil {
			return summary(), err
		}
		// 作品走跟作者刪除同一組 helper（搜尋索引、封面資產引用）
		for i := range projects {
			if err := s.withDeleteReason(&storytellerModel.Project{}, projects[i].ID, user.DeleteReason, func() error { return s.deleteProjectRecord(&projects[i]) }); err != nil {
				return summary(), err
			}
		}
		profiles, err := s.repo.LiveAuthorProfilesByUser(user.ID)
		if err != nil {
			return summary(), err
		}
		// 額外筆名走 DeleteAuthorProfile，連帶取消以它做的追蹤
		for i := range profiles {
			if err := s.repo.DeleteAuthorProfile(&profiles[i], &user.DeleteReason); err != nil {
				return summary(), err
			}
		}
		counts, err := s.repo.PurgeUserSocialContent(user.ID, user.DeleteReason)
		if err != nil {
			return summary(), err
		}
		totals["projects"] += int64(len(projects))
		totals["author_profiles"] += int64(len(profiles))
		for name, count := range counts {
			totals[name] += count
		}
	}
	return summary(), nil
}
