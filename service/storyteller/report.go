package storyteller

import (
	"strings"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/repository"
	"gorm.io/gorm"
)

// 讀者檢舉。目標一律先確認「檢舉的人看得到」（看不到就 404，不透露存在與否），
// 不能檢舉自己的內容；同一人對同一目標還在待處理時不重複建立、直接當成功。
// 後台處理（resolved／dismissed、執行刪除並寫 delete_reason、通知擁有者）之後再做。

var (
	ErrReportOwnContent    = PostValidationError("不能檢舉自己的內容")
	ErrReportInvalidTarget = PostValidationError("無法檢舉這個項目")
	ErrReportInvalidReason = PostValidationError("請選擇有效的檢舉原因")
	ErrReportNoteRequired  = PostValidationError("選擇「其他」時請填寫補充說明")
)

// reportTarget 是解析後要存進檢舉紀錄的對象，OwnerID 用來擋「檢舉自己」。
type reportTarget struct {
	Type    storytellerModel.ReportTargetType
	ID      uint64
	OwnerID uint64
}

// ModerationReasons 回傳讀者檢舉這種對象時可選的理由（只含 is_reportable）。
func (s *Service) ModerationReasons(targetType storytellerModel.ReportTargetType) ([]storytellerModel.ModerationReasonOutput, error) {
	rows, err := s.repo.ModerationReasons()
	if err != nil {
		return nil, err
	}
	out := make([]storytellerModel.ModerationReasonOutput, 0, len(rows))
	for i := range rows {
		if rows[i].IsReportable && (targetType == "" || rows[i].AppliesToTarget(targetType)) {
			out = append(out, storytellerModel.ModerationReasonOutput{Key: rows[i].ReasonKey, NoteRequired: rows[i].ReasonKey == storytellerModel.ModerationReasonOther})
		}
	}
	return out, nil
}

// CreateReport 建立檢舉；重複檢舉（同目標仍待處理）回成功但不新增。
func (s *Service) CreateReport(viewerID uint64, input storytellerModel.ReportRequest) error {
	if viewerID == 0 {
		return ErrAuthorPostForbidden
	}
	target, err := s.resolveReportTarget(viewerID, input)
	if err != nil {
		return err
	}
	if target.OwnerID == viewerID {
		return ErrReportOwnContent
	}
	reason, err := s.repo.ModerationReasonByKey(strings.TrimSpace(input.ReasonKey))
	if repository.IsRecordNotFound(err) {
		return ErrReportInvalidReason
	}
	if err != nil {
		return err
	}
	note, err := checkReportReason(reason, input.TargetType, input.Note)
	if err != nil {
		return err
	}
	if pending, err := s.repo.HasPendingReport(viewerID, target.Type, target.ID); err != nil || pending {
		return err
	}
	row := &storytellerModel.Report{
		PublicID: randomID(), ReporterUserID: viewerID, TargetType: target.Type, TargetID: target.ID,
		ReasonKey: reason.ReasonKey, Status: storytellerModel.ReportStatusPending,
	}
	if note != "" {
		row.Note = &note
	}
	return s.repo.CreateReport(row)
}

// checkReportReason 確認理由可由讀者選、適用於這種對象，並整理補充說明（「其他」必填）。
func checkReportReason(reason *storytellerModel.ModerationReason, targetType storytellerModel.ReportTargetType, note string) (string, error) {
	if !reason.IsReportable || !reason.AppliesToTarget(targetType) {
		return "", ErrReportInvalidReason
	}
	if strings.TrimSpace(note) == "" {
		if reason.ReasonKey == storytellerModel.ModerationReasonOther {
			return "", ErrReportNoteRequired
		}
		return "", nil
	}
	return normalizePostBody(note, "補充說明", storytellerModel.ReportNoteMaxRunes)
}

// resolveReportTarget 依對象種類找出目標，並套用跟閱讀時相同的可見度規則。
func (s *Service) resolveReportTarget(viewerID uint64, input storytellerModel.ReportRequest) (*reportTarget, error) {
	publicID, share := strings.TrimSpace(input.TargetPublicID), strings.TrimSpace(input.Share)
	if publicID == "" {
		return nil, ErrReportInvalidTarget
	}
	switch input.TargetType {
	case storytellerModel.ReportTargetProject:
		project, err := s.discussionProject(publicID, share, viewerID)
		if err != nil {
			return nil, err
		}
		return &reportTarget{Type: input.TargetType, ID: project.ID, OwnerID: project.UserID}, nil
	case storytellerModel.ReportTargetStory, storytellerModel.ReportTargetLore:
		project, err := s.discussionProject(strings.TrimSpace(input.ProjectPublicID), share, viewerID)
		if err != nil {
			return nil, err
		}
		var id uint64
		if input.TargetType == storytellerModel.ReportTargetStory {
			story, err := s.repo.PublishedStory(project.ID, publicID)
			if err != nil {
				return nil, err
			}
			id = story.ID
		} else {
			lore, err := s.repo.PublishedLore(project.ID, publicID)
			if err != nil {
				return nil, err
			}
			id = lore.ID
		}
		return &reportTarget{Type: input.TargetType, ID: id, OwnerID: project.UserID}, nil
	case storytellerModel.ReportTargetAuthor:
		// 創作者以筆名指定：本人身份存 user、額外筆名存 author_profile
		identity, err := s.resolveAuthorIdentityByPenName(publicID)
		if err != nil {
			return nil, err
		}
		if identity.ProfileID == 0 {
			return &reportTarget{Type: storytellerModel.ReportTargetUser, ID: identity.UserID, OwnerID: identity.UserID}, nil
		}
		return &reportTarget{Type: storytellerModel.ReportTargetAuthorProfile, ID: identity.ProfileID, OwnerID: identity.UserID}, nil
	case storytellerModel.ReportTargetAuthorPost:
		post, err := s.repo.AuthorPostByPublicID(publicID)
		if err != nil {
			return nil, err
		}
		return &reportTarget{Type: input.TargetType, ID: post.ID, OwnerID: post.UserID}, nil
	case storytellerModel.ReportTargetDiscussionThread:
		thread, _, err := s.discussionThread(publicID, share, viewerID)
		if err != nil {
			return nil, err
		}
		return &reportTarget{Type: input.TargetType, ID: thread.ID, OwnerID: thread.UserID}, nil
	case storytellerModel.ReportTargetComment:
		comment, place, err := s.commentWithPlace(publicID)
		if err != nil {
			return nil, err
		}
		if place.project != nil && !discussionAccessible(place.project, share, viewerID) {
			return nil, gorm.ErrRecordNotFound
		}
		return &reportTarget{Type: input.TargetType, ID: comment.ID, OwnerID: comment.UserID}, nil
	}
	return nil, ErrReportInvalidTarget
}
