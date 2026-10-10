package storyteller

import (
	"strings"
	"unicode/utf8"

	storytellerModel "faryne.dev/model/entity/storyteller"
	storytellerRepo "faryne.dev/repository/storyteller"
)

// 後台檢舉對象的摘要。管理員要看到原文（不遮劇透標記），也要看得到已刪除與被停權的內容，
// 所以這裡一律用含已刪除的查詢，不走前台的可見度規則。

// adminExcerptRunes 是列表上內文摘要的長度
const adminExcerptRunes = 80

func adminExcerpt(text string) string {
	text = strings.Join(strings.Fields(text), " ")
	if utf8.RuneCountInString(text) <= adminExcerptRunes {
		return text
	}
	return string([]rune(text)[:adminExcerptRunes]) + "…"
}

// adminIdentityName 是身份目前的筆名（含已刪除的筆名與被停權的帳號）。
func (s *Service) adminIdentityName(userID, profileID uint64) string {
	if profileID != 0 {
		if row, err := storytellerRepo.AdminRowByID[storytellerModel.AuthorProfile](s.repo, profileID); err == nil {
			return row.PenName
		}
		return ""
	}
	if row, err := storytellerRepo.AdminRowByID[storytellerModel.UserProfile](s.repo, userID); err == nil {
		return row.PenName
	}
	return ""
}

// adminTarget 組出一個檢舉對象的摘要；detail 時多帶全文與創作者的足跡。
func (s *Service) adminTarget(targetType storytellerModel.ReportTargetType, id uint64, detail bool) (*storytellerModel.AdminReportTarget, error) {
	out := &storytellerModel.AdminReportTarget{Type: targetType, ID: id}
	// withBody：留言／動態／討論串列表給摘要、詳情給全文
	withBody := func(body string) {
		out.Excerpt = adminExcerpt(body)
		if detail {
			out.Body = body
		}
	}
	switch targetType {
	case storytellerModel.ReportTargetComment:
		row, err := storytellerRepo.AdminRowByID[storytellerModel.Comment](s.repo, id)
		if err != nil {
			return nil, err
		}
		out.OwnerUserID, out.OwnerName = row.UserID, s.adminIdentityName(row.UserID, row.ProfileID)
		out.PublicID, out.Deleted, out.DeleteReason, out.CreatedAt = row.PublicID, row.IsDeleted, stringValue(row.DeleteReason), &row.CreatedAt
		out.Link.CommentPublicID = row.PublicID
		withBody(row.Body)
		if row.TargetType == storytellerModel.CommentTargetDiscussionThread {
			s.fillAdminThreadContext(out, row.TargetID)
		} else if post, err := storytellerRepo.AdminRowByID[storytellerModel.AuthorPost](s.repo, row.TargetID); err == nil {
			out.Link.PostPublicID, out.Link.PenName = post.PublicID, s.adminIdentityName(post.UserID, post.ProfileID)
		}
	case storytellerModel.ReportTargetAuthorPost:
		row, err := storytellerRepo.AdminRowByID[storytellerModel.AuthorPost](s.repo, id)
		if err != nil {
			return nil, err
		}
		out.OwnerUserID, out.OwnerName = row.UserID, s.adminIdentityName(row.UserID, row.ProfileID)
		out.PublicID, out.Deleted, out.DeleteReason, out.CreatedAt = row.PublicID, row.IsDeleted, stringValue(row.DeleteReason), &row.CreatedAt
		out.Link.PostPublicID, out.Link.PenName = row.PublicID, out.OwnerName
		withBody(row.Body)
	case storytellerModel.ReportTargetDiscussionThread:
		row, err := storytellerRepo.AdminRowByID[storytellerModel.DiscussionThread](s.repo, id)
		if err != nil {
			return nil, err
		}
		out.Title, out.OwnerUserID, out.OwnerName = row.Title, row.UserID, s.adminIdentityName(row.UserID, row.ProfileID)
		out.PublicID, out.Deleted, out.DeleteReason, out.CreatedAt = row.PublicID, row.IsDeleted, stringValue(row.DeleteReason), &row.CreatedAt
		withBody(row.Body)
		s.fillAdminThreadContext(out, row.ID)
	case storytellerModel.ReportTargetStory:
		row, err := storytellerRepo.AdminRowByID[storytellerModel.Story](s.repo, id)
		if err != nil {
			return nil, err
		}
		out.Title, out.IsVolume = row.Title, row.IsVolume
		out.PublicID, out.Deleted, out.DeleteReason, out.CreatedAt = row.PublicID, row.IsDeleted, stringValue(row.DeleteReason), &row.CreatedAt
		out.Link.StoryPublicID = row.PublicID
		s.fillAdminProjectContext(out, row.ProjectID)
	case storytellerModel.ReportTargetLore:
		row, err := storytellerRepo.AdminRowByID[storytellerModel.Lore](s.repo, id)
		if err != nil {
			return nil, err
		}
		out.Title = row.Title
		out.PublicID, out.Deleted, out.DeleteReason, out.CreatedAt = row.PublicID, row.IsDeleted, stringValue(row.DeleteReason), &row.CreatedAt
		out.Link.LorePublicID = row.PublicID
		s.fillAdminProjectContext(out, row.ProjectID)
	case storytellerModel.ReportTargetProject:
		row, err := storytellerRepo.AdminRowByID[storytellerModel.Project](s.repo, id)
		if err != nil {
			return nil, err
		}
		out.Title, out.OwnerUserID, out.OwnerName = row.Name, row.UserID, s.adminIdentityName(row.UserID, 0)
		out.PublicID, out.Deleted, out.DeleteReason, out.CreatedAt = row.PublicID, row.IsDeleted, stringValue(row.DeleteReason), &row.CreatedAt
		out.Link.ProjectPublicID, out.Link.ProjectSlug = row.PublicID, row.Slug
	case storytellerModel.ReportTargetUser:
		row, err := storytellerRepo.AdminRowByID[storytellerModel.UserProfile](s.repo, id)
		if err != nil {
			return nil, err
		}
		out.Title, out.OwnerUserID, out.OwnerName = row.PenName, row.ID, row.PenName
		out.PublicID, out.Deleted, out.DeleteReason, out.CreatedAt = row.PublicID, row.IsDeleted, stringValue(row.DeleteReason), &row.CreatedAt
		out.Link.PenName = row.PenName
		if detail {
			footprint, err := s.repo.AdminFootprint(row.ID, nil)
			if err != nil {
				return nil, err
			}
			profiles, err := s.repo.LiveAuthorProfilesByUser(row.ID)
			if err != nil {
				return nil, err
			}
			out.Footprint = &footprint
			for _, profile := range profiles {
				out.ExtraPenNames = append(out.ExtraPenNames, profile.PenName)
			}
		}
	case storytellerModel.ReportTargetAuthorProfile:
		row, err := storytellerRepo.AdminRowByID[storytellerModel.AuthorProfile](s.repo, id)
		if err != nil {
			return nil, err
		}
		out.Title, out.OwnerUserID, out.OwnerName = row.PenName, row.UserID, row.PenName
		out.PublicID, out.Deleted, out.DeleteReason, out.CreatedAt = row.PublicID, row.IsDeleted, stringValue(row.DeleteReason), &row.CreatedAt
		out.Link.PenName, out.AccountPenName = row.PenName, s.adminIdentityName(row.UserID, 0)
		if detail {
			footprint, err := s.repo.AdminFootprint(row.UserID, &row.ID)
			if err != nil {
				return nil, err
			}
			out.Footprint = &footprint
		}
	default:
		return nil, ErrReportInvalidTarget
	}
	return out, nil
}

// fillAdminThreadContext 補上討論串標題與所屬作品（留言、討論串共用）。
func (s *Service) fillAdminThreadContext(out *storytellerModel.AdminReportTarget, threadID uint64) {
	thread, err := storytellerRepo.AdminRowByID[storytellerModel.DiscussionThread](s.repo, threadID)
	if err != nil {
		return
	}
	out.ContextThread, out.Link.ThreadPublicID = thread.Title, thread.PublicID
	s.fillAdminProjectContext(out, thread.ProjectID)
}

// fillAdminProjectContext 補上所屬作品；故事與設定的擁有者就是作品擁有者。
func (s *Service) fillAdminProjectContext(out *storytellerModel.AdminReportTarget, projectID uint64) {
	project, err := storytellerRepo.AdminRowByID[storytellerModel.Project](s.repo, projectID)
	if err != nil {
		return
	}
	out.ContextProject, out.Link.ProjectPublicID, out.Link.ProjectSlug = project.Name, project.PublicID, project.Slug
	if out.OwnerUserID == 0 {
		out.OwnerUserID, out.OwnerName = project.UserID, s.adminIdentityName(project.UserID, 0)
	}
}
