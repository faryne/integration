package storyteller

import (
	"cmp"
	"fmt"
	"slices"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/repository"
	storytellerRepo "faryne.dev/repository/storyteller"
	"faryne.dev/service/log"
	notifyService "faryne.dev/service/storytellernotify"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

// 後台檢舉處理。處置是對「被檢舉的對象」做：移除（或停權）後該對象所有待處理檢舉一起結案，
// 駁回則一起改成已駁回。每支方法進來先檢查平台權限，不借用作者 user_id 呼叫 owner-only 方法。

var (
	ErrAdminSelf   = PostValidationError("不能處置自己的內容或帳號")
	ErrAdminVolume = PostValidationError("冊不能直接移除，請移除冊裡的單話")
)

// adminTargetTypeLabels 只給通知的通用文字（Title／Body）用；畫面上的文字由前端組。
var adminTargetTypeLabels = map[storytellerModel.ReportTargetType]string{
	storytellerModel.ReportTargetComment: "留言", storytellerModel.ReportTargetAuthorPost: "動態",
	storytellerModel.ReportTargetDiscussionThread: "討論串", storytellerModel.ReportTargetStory: "故事",
	storytellerModel.ReportTargetLore: "設定", storytellerModel.ReportTargetProject: "作品",
	storytellerModel.ReportTargetAuthorProfile: "筆名",
}

// reasonCounts 統計各原因次數，多的在前。
func reasonCounts(reports []storytellerModel.Report) []storytellerModel.AdminReasonCount {
	counts := map[string]int64{}
	for _, report := range reports {
		counts[report.ReasonKey]++
	}
	out := make([]storytellerModel.AdminReasonCount, 0, len(counts))
	for key, count := range counts {
		out = append(out, storytellerModel.AdminReasonCount{Key: key, Count: count})
	}
	slices.SortFunc(out, func(a, b storytellerModel.AdminReasonCount) int {
		return cmp.Or(cmp.Compare(b.Count, a.Count), cmp.Compare(a.Key, b.Key))
	})
	return out
}

func (s *Service) AdminReports(viewerID uint64, query storytellerModel.AdminReportListQuery) (*storytellerModel.AdminReportListOutput, error) {
	if _, err := s.requirePlatform(viewerID, storytellerModel.PermissionAdminReportRead); err != nil {
		return nil, err
	}
	status := cmp.Or(query.Status, storytellerModel.ReportStatusPending)
	if !slices.Contains([]storytellerModel.ReportStatus{storytellerModel.ReportStatusPending, storytellerModel.ReportStatusResolved, storytellerModel.ReportStatusDismissed}, status) {
		return nil, PostValidationError("無效的狀態")
	}
	page := max(query.Page, 1)
	rows, total, err := s.repo.AdminReportGroups(status, query.TargetType, (page-1)*storytellerModel.AdminReportPageSize, storytellerModel.AdminReportPageSize)
	if err != nil {
		return nil, err
	}
	counts, err := s.repo.AdminReportStatusCounts()
	if err != nil {
		return nil, err
	}
	out := &storytellerModel.AdminReportListOutput{Items: make([]storytellerModel.AdminReportGroup, 0, len(rows)), Total: total, Page: page, Counts: counts}
	for _, row := range rows {
		target, err := s.adminTarget(row.TargetType, row.TargetID, false)
		if repository.IsRecordNotFound(err) {
			// 對象整列不存在（理論上不會發生，soft delete 都還在）：只留種類與 id，讓管理員仍能駁回
			target, err = &storytellerModel.AdminReportTarget{Type: row.TargetType, ID: row.TargetID, Deleted: true}, nil
		}
		if err != nil {
			return nil, err
		}
		reports, err := s.repo.ReportsByTargetStatus(row.TargetType, row.TargetID, status)
		if err != nil {
			return nil, err
		}
		out.Items = append(out.Items, storytellerModel.AdminReportGroup{
			Target: *target, Count: row.Count, Reasons: reasonCounts(reports),
			LastReportedAt: row.LastReportedAt, LastHandledAt: row.LastHandledAt,
		})
	}
	return out, nil
}

func (s *Service) AdminReportDetail(viewerID uint64, targetType storytellerModel.ReportTargetType, targetID uint64) (*storytellerModel.AdminReportDetailOutput, error) {
	auth, err := s.requirePlatform(viewerID, storytellerModel.PermissionAdminReportRead)
	if err != nil {
		return nil, err
	}
	reports, err := s.repo.ReportsByTarget(targetType, targetID)
	if err != nil {
		return nil, err
	}
	if len(reports) == 0 {
		return nil, gorm.ErrRecordNotFound
	}
	target, err := s.adminTarget(targetType, targetID, true)
	if err != nil {
		return nil, err
	}
	pending := slices.DeleteFunc(slices.Clone(reports), func(r storytellerModel.Report) bool { return r.Status != storytellerModel.ReportStatusPending })
	// 原因統計：還有待處理就只算待處理的，已處理完的對象算全部
	counted := pending
	if len(pending) == 0 {
		counted = reports
	}
	out := &storytellerModel.AdminReportDetailOutput{Target: *target, Pending: int64(len(pending)), Reasons: reasonCounts(counted)}
	for _, report := range reports {
		entry := storytellerModel.AdminReportEntry{
			PublicID: report.PublicID, ReasonKey: report.ReasonKey, Note: stringValue(report.Note),
			ReporterName: s.adminIdentityName(report.ReporterUserID, 0), Status: report.Status,
			HandledAt: report.HandledAt, CreatedAt: report.CreatedAt,
		}
		if report.HandledByUserID != nil {
			entry.HandledBy = s.adminIdentityName(*report.HandledByUserID, 0)
		}
		out.Reports = append(out.Reports, entry)
	}
	if out.Actions, err = s.adminActions(auth, target, viewerID, len(pending), out.Reasons); err != nil {
		return nil, err
	}
	return out, nil
}

// adminActions 依權限與對象狀態決定能做什麼；沒有待處理的檢舉就什麼都不能做。
func (s *Service) adminActions(auth PlatformAuthorization, target *storytellerModel.AdminReportTarget, viewerID uint64, pending int, reasons []storytellerModel.AdminReasonCount) (storytellerModel.AdminReportActions, error) {
	var out storytellerModel.AdminReportActions
	if pending == 0 || !auth.Has(storytellerModel.PermissionAdminReportUpdate) {
		return out, nil
	}
	if target.Deleted {
		out.CanClose = true
		return out, nil
	}
	out.CanDismiss = true
	out.CanRemove = auth.Has(storytellerModel.AdminRemovePermission[target.Type]) && target.OwnerUserID != viewerID && !target.IsVolume
	if !out.CanRemove {
		return out, nil
	}
	rows, err := s.repo.ModerationReasons()
	if err != nil {
		return out, err
	}
	for i := range rows {
		if rows[i].AppliesToTarget(target.Type) {
			out.RemoveReasons = append(out.RemoveReasons, rows[i].ReasonKey)
		}
	}
	// 預設理由：被檢舉最多次、且可用的那個
	for _, reason := range reasons {
		if slices.Contains(out.RemoveReasons, reason.Key) {
			out.DefaultReason = reason.Key
			break
		}
	}
	return out, nil
}

// AdminRemoveReportTarget 移除對象（創作者本人＝停權）並結案。對象已被作者自行刪除時只結案、不覆寫理由，
// 這時只需要 admin.report.update。
func (s *Service) AdminRemoveReportTarget(viewerID uint64, targetType storytellerModel.ReportTargetType, targetID uint64, input storytellerModel.AdminRemoveRequest) error {
	auth, err := s.requirePlatform(viewerID, storytellerModel.PermissionAdminReportUpdate)
	if err != nil {
		return err
	}
	removePermission, ok := storytellerModel.AdminRemovePermission[targetType]
	if !ok {
		return ErrReportInvalidTarget
	}
	target, err := s.adminTarget(targetType, targetID, false)
	if err != nil {
		return err
	}
	if !target.Deleted {
		if !auth.Has(removePermission) {
			return ErrAdminForbidden
		}
		if target.OwnerUserID == viewerID {
			return ErrAdminSelf
		}
		if target.IsVolume {
			return ErrAdminVolume
		}
		reason, err := s.repo.ModerationReasonByKey(input.ReasonKey)
		if repository.IsRecordNotFound(err) || (err == nil && !reason.AppliesToTarget(targetType)) {
			return ErrReportInvalidReason
		}
		if err != nil {
			return err
		}
		if err := s.adminRemove(targetType, targetID, reason.ReasonKey); err != nil {
			return err
		}
		if targetType != storytellerModel.ReportTargetUser {
			s.notifyModerationRemoved(target, reason.ReasonKey)
		}
	}
	_, err = s.repo.HandlePendingReports(targetType, targetID, storytellerModel.ReportStatusResolved, viewerID)
	return err
}

// AdminDismissReportTarget 駁回：內容不動，待處理的檢舉改成已駁回（沒有待處理的也回成功）。
func (s *Service) AdminDismissReportTarget(viewerID uint64, targetType storytellerModel.ReportTargetType, targetID uint64) error {
	if _, err := s.requirePlatform(viewerID, storytellerModel.PermissionAdminReportUpdate); err != nil {
		return err
	}
	_, err := s.repo.HandlePendingReports(targetType, targetID, storytellerModel.ReportStatusDismissed, viewerID)
	return err
}

// adminRemove 先寫理由再 soft delete，副作用（搜尋索引、資產引用、冊異動）跟作者自己刪除走同一組 helper。
func (s *Service) adminRemove(targetType storytellerModel.ReportTargetType, id uint64, reason string) error {
	switch targetType {
	case storytellerModel.ReportTargetComment:
		return s.withDeleteReason(&storytellerModel.Comment{}, id, reason, func() error { return s.repo.SoftDeleteComment(id) })
	case storytellerModel.ReportTargetAuthorPost:
		return s.withDeleteReason(&storytellerModel.AuthorPost{}, id, reason, func() error { return s.repo.SoftDeleteAuthorPost(id) })
	case storytellerModel.ReportTargetDiscussionThread:
		return s.withDeleteReason(&storytellerModel.DiscussionThread{}, id, reason, func() error { return s.repo.SoftDeleteDiscussionThread(id) })
	case storytellerModel.ReportTargetStory:
		row, err := storytellerRepo.AdminRowByID[storytellerModel.Story](s.repo, id)
		if err != nil {
			return err
		}
		return s.withDeleteReason(&storytellerModel.Story{}, id, reason, func() error { return s.deleteStoryRecord(row) })
	case storytellerModel.ReportTargetLore:
		row, err := storytellerRepo.AdminRowByID[storytellerModel.Lore](s.repo, id)
		if err != nil {
			return err
		}
		return s.withDeleteReason(&storytellerModel.Lore{}, id, reason, func() error { return s.deleteLoreRecord(row) })
	case storytellerModel.ReportTargetProject:
		row, err := storytellerRepo.AdminRowByID[storytellerModel.Project](s.repo, id)
		if err != nil {
			return err
		}
		return s.withDeleteReason(&storytellerModel.Project{}, id, reason, func() error { return s.deleteProjectRecord(row) })
	case storytellerModel.ReportTargetAuthorProfile:
		row, err := storytellerRepo.AdminRowByID[storytellerModel.AuthorProfile](s.repo, id)
		if err != nil {
			return err
		}
		// 連帶這個筆名的動態、討論串、留言，全部寫入同一個理由（見 repository.DeleteAuthorProfile）
		return s.repo.DeleteAuthorProfile(row, &reason)
	case storytellerModel.ReportTargetUser:
		// 停權當下不動內容；停權滿 bannedAccountPurgeAfter 後由排程清除（見 admin_ban_purge.go）
		return s.repo.BanUser(id, reason)
	}
	return ErrReportInvalidTarget
}

// withDeleteReason 先寫理由再刪除：刪除失敗時理由只是多寫在一筆仍公開的列上，前台只看已刪除的列，不會誤顯示。
func (s *Service) withDeleteReason(model any, id uint64, reason string, remove func() error) error {
	if err := s.repo.SetDeleteReason(model, id, reason); err != nil {
		return err
	}
	return remove()
}

// notifyModerationRemoved 通知被移除內容的擁有者；通知失敗不影響處置本身。
func (s *Service) notifyModerationRemoved(target *storytellerModel.AdminReportTarget, reason string) {
	label := cmp.Or(target.Title, target.Excerpt)
	typeLabel := adminTargetTypeLabels[target.Type]
	err := notifyService.NewService().Notify([]notifyService.Input{{
		// 同一個對象只會被移除一次，用對象當 group key
		UserID: target.OwnerUserID, Kind: storytellerModel.NotificationKindModerationRemoved,
		GroupKey: fmt.Sprintf("moderation:%s:%d", target.Type, target.ID),
		Payload: storytellerModel.NotificationPayload{
			Title: "你的" + typeLabel + "已由站方移除", Body: label,
			Label: label, ModerationTargetType: string(target.Type), DeleteReason: reason,
		},
	}})
	if err != nil {
		log.Logger().Error("Storyteller moderation notification failed", zap.String("target_type", string(target.Type)), zap.Uint64("target_id", target.ID), zap.Error(err))
	}
}
