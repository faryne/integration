package storyteller

import (
	"errors"
	"slices"
	"strings"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"gorm.io/gorm"
)

// 專案討論版。討論串屬於專案、可錨定在某一話或某篇設定；回覆沿用動態的留言（Comment）。
// - 公開作品任何人可看；不公開（僅限連結）作品要帶分享 token 或是作者本人；私人作品沒有討論版。
// - 發言（開串、留言、編輯）比照動態留言：要登入、本人要有筆名、沒被作者封鎖。
// - 作者（作品擁有者）可以用作品署名過的任一身份發言；封鎖記在作品所有署名身份上，跟動態共用封鎖名單。

var (
	// ErrDiscussionLocked：串已鎖定，不能再回覆或編輯
	ErrDiscussionLocked = errors.New("discussion thread locked")
	// ErrDiscussionIdentity：作者指定的身份不是這部作品的署名身份
	ErrDiscussionIdentity = PostValidationError("無法使用這個身份發言")
)

const (
	discussionRateLimit  = 10
	discussionRateWindow = time.Hour
)

// discussionAccessible：公開作品都能看；不公開作品要分享 token 對得上或是作者本人；私人作品一律沒有討論版。
func discussionAccessible(project *storytellerModel.Project, shareToken string, viewerID uint64) bool {
	switch project.Visibility {
	case storytellerModel.ProjectVisibilityPublic:
		return true
	case storytellerModel.ProjectVisibilityUnlisted:
		return (viewerID != 0 && viewerID == project.UserID) || (shareToken != "" && shareToken == project.ShareToken)
	}
	return false
}

func (s *Service) discussionProject(projectPublicID, shareToken string, viewerID uint64) (*storytellerModel.Project, error) {
	project, err := s.repo.ProjectByPublicIDAny(projectPublicID)
	if err != nil {
		return nil, err
	}
	if !discussionAccessible(project, strings.TrimSpace(shareToken), viewerID) {
		return nil, gorm.ErrRecordNotFound
	}
	return project, nil
}

// discussionThread 取串並確認看得到它所在的作品。
func (s *Service) discussionThread(threadPublicID, shareToken string, viewerID uint64) (*storytellerModel.DiscussionThread, *storytellerModel.Project, error) {
	thread, err := s.repo.DiscussionThreadByPublicID(threadPublicID)
	if err != nil {
		return nil, nil, err
	}
	project, err := s.repo.ProjectByID(thread.ProjectID)
	if err != nil {
		return nil, nil, err
	}
	if !discussionAccessible(project, strings.TrimSpace(shareToken), viewerID) {
		return nil, nil, gorm.ErrRecordNotFound
	}
	return thread, project, nil
}

// projectSigning 是作品署名過的身份（沒有任何 pivot 列＝本人）；作者可用的發言身份、封鎖範圍都以它為準。
func (s *Service) projectSigning(project *storytellerModel.Project) ([]uint64, error) {
	signing, err := s.repo.ProjectSigningProfiles([]uint64{project.ID})
	if err != nil {
		return nil, err
	}
	if ids := signing[project.ID]; len(ids) > 0 {
		return ids, nil
	}
	return []uint64{0}, nil
}

// ensureNotBlockedInProject：被作品任一署名身份封鎖的人不能在這部作品的討論版發言（作者自己不會被擋）。
func (s *Service) ensureNotBlockedInProject(project *storytellerModel.Project, viewerID uint64) error {
	if viewerID == project.UserID {
		return nil
	}
	signing, err := s.projectSigning(project)
	if err != nil {
		return err
	}
	blocked, err := s.repo.BlockedByAnyIdentity(project.UserID, signing, []uint64{viewerID})
	if err != nil {
		return err
	}
	if blocked[viewerID] {
		return ErrCommentBlocked
	}
	return nil
}

// blockInProject 以作品所有署名身份封鎖對方：討論版與這些身份的動態都不能再發言。
func (s *Service) blockInProject(project *storytellerModel.Project, blockedUserID uint64) error {
	signing, err := s.projectSigning(project)
	if err != nil {
		return err
	}
	for _, profileID := range signing {
		if err := s.repo.UpsertAuthorBlock(&storytellerModel.AuthorBlock{
			PublicID: randomID(), UserID: project.UserID, ProfileID: profileID, BlockedUserID: blockedUserID,
		}); err != nil {
			return err
		}
	}
	return nil
}

// discussionSpeaker 是看的人在這部作品能用的發言身份（筆名 → 身份鍵）與狀態。
type discussionSpeaker struct {
	State   storytellerModel.CommentViewerState
	Options []followBackCandidate
	// Blocked：被作者封鎖（不能發言，也不能編輯自己以前的內容）
	Blocked bool
}

func (sp *discussionSpeaker) output() storytellerModel.DiscussionViewerOutput {
	out := storytellerModel.DiscussionViewerOutput{State: sp.State}
	for _, option := range sp.Options {
		out.As = append(out.As, option.PenName)
	}
	return out
}

// pick 依 as（筆名）選身份；空白用第一個（預設身份）。
func (sp *discussionSpeaker) pick(as string) (storytellerModel.AuthorIdentityKey, error) {
	switch sp.State {
	case storytellerModel.CommentViewerBlocked:
		return storytellerModel.AuthorIdentityKey{}, ErrCommentBlocked
	case storytellerModel.CommentViewerNeedPenName:
		return storytellerModel.AuthorIdentityKey{}, ErrCommentPenNameRequired
	case storytellerModel.CommentViewerLoginRequired:
		return storytellerModel.AuthorIdentityKey{}, ErrAuthorPostForbidden
	}
	as = strings.TrimSpace(as)
	if as == "" {
		return sp.Options[0].Key, nil
	}
	for _, option := range sp.Options {
		if option.PenName == as {
			return option.Key, nil
		}
	}
	return storytellerModel.AuthorIdentityKey{}, ErrDiscussionIdentity
}

// discussionSpeakerFor 算出看的人的發言狀態：作者用作品署名過的身份（preferred 排前面，通常是錨定那一話的署名），
// 讀者用本人且要有筆名、沒被封鎖。
func (s *Service) discussionSpeakerFor(project *storytellerModel.Project, viewerID uint64, preferred []uint64) (*discussionSpeaker, error) {
	if viewerID == 0 {
		return &discussionSpeaker{State: storytellerModel.CommentViewerLoginRequired}, nil
	}
	signing, err := s.projectSigning(project)
	if err != nil {
		return nil, err
	}
	keys := []storytellerModel.AuthorIdentityKey{{UserID: viewerID}}
	if viewerID == project.UserID {
		ordered := append(slices.Clone(preferred), signing...)
		keys = keys[:0]
		for _, profileID := range uniqueUint64(ordered) {
			if slices.Contains(signing, profileID) {
				keys = append(keys, storytellerModel.AuthorIdentityKey{UserID: viewerID, ProfileID: profileID})
			}
		}
	} else {
		blocked, err := s.repo.BlockedByAnyIdentity(project.UserID, signing, []uint64{viewerID})
		if err != nil {
			return nil, err
		}
		if blocked[viewerID] {
			return &discussionSpeaker{State: storytellerModel.CommentViewerBlocked, Blocked: true}, nil
		}
	}
	book, err := loadIdentityBook(s.repo, keys)
	if err != nil {
		return nil, err
	}
	speaker := &discussionSpeaker{State: storytellerModel.CommentViewerCanComment}
	for _, key := range keys {
		// 沒有筆名的身份（本人沒設 pen_name）不能拿來發言，不能退回 display name／email
		if identity, ok := book.lookup(key); ok {
			speaker.Options = append(speaker.Options, followBackCandidate{Key: key, PenName: identity.PenName})
		}
	}
	if len(speaker.Options) == 0 {
		speaker.State = storytellerModel.CommentViewerNeedPenName
	}
	return speaker, nil
}

// anchorSigners 是錨定那一話的署名身份；作者發言時預設用它。
func (s *Service) anchorSigners(thread *storytellerModel.DiscussionThread) ([]uint64, error) {
	if thread == nil || thread.AnchorType != storytellerModel.DiscussionAnchorStory {
		return nil, nil
	}
	profiles, err := s.repo.StoryProfilesByStoryIDs([]uint64{thread.AnchorID})
	if err != nil {
		return nil, err
	}
	if ids := profiles[thread.AnchorID]; len(ids) > 0 {
		return ids, nil
	}
	return []uint64{0}, nil
}

// resolveAnchor 驗證錨點：只能擇一，而且必須是這部作品對讀者可見的話或設定。
func (s *Service) resolveAnchor(project *storytellerModel.Project, storyPublicID, lorePublicID string) (storytellerModel.DiscussionAnchorType, uint64, error) {
	storyPublicID, lorePublicID = strings.TrimSpace(storyPublicID), strings.TrimSpace(lorePublicID)
	invalid := PostValidationError("找不到要討論的故事或設定")
	switch {
	case storyPublicID != "" && lorePublicID != "":
		return "", 0, invalid
	case storyPublicID != "":
		refs, err := s.repo.VisibleStoryRefs(project.ID, nil, []string{storyPublicID})
		if err != nil || len(refs) == 0 {
			return "", 0, cmpErr(err, invalid)
		}
		return storytellerModel.DiscussionAnchorStory, refs[0].ID, nil
	case lorePublicID != "":
		refs, err := s.repo.VisibleLoreRefs(project.ID, nil, []string{lorePublicID})
		if err != nil || len(refs) == 0 {
			return "", 0, cmpErr(err, invalid)
		}
		return storytellerModel.DiscussionAnchorLore, refs[0].ID, nil
	}
	return storytellerModel.DiscussionAnchorNone, 0, nil
}

// cmpErr：有 DB 錯誤就回 DB 錯誤，否則回 fallback。
func cmpErr(err, fallback error) error {
	if err != nil {
		return err
	}
	return fallback
}

func normalizeDiscussionThread(title, body string) (string, string, error) {
	title, err := normalizePostBody(strings.Join(strings.Fields(title), " "), "標題", storytellerModel.DiscussionTitleMaxRunes)
	if err != nil {
		return "", "", err
	}
	body, err = normalizePostBody(body, "內容", storytellerModel.DiscussionBodyMaxRunes)
	return title, body, err
}

// notifyDiscussion 是討論版通知的接口：v1 依決定先不發任何通知，之後補實作時只改這裡
// （開串通知作者、回覆通知發串者與被回覆的人等規則見規格文件）。
func (s *Service) notifyDiscussion(_ *storytellerModel.DiscussionThread, _ *storytellerModel.Comment) {
}

func (s *Service) CreateDiscussionThread(viewerID uint64, projectPublicID, shareToken string, input storytellerModel.DiscussionThreadRequest) (*storytellerModel.DiscussionThreadOutput, error) {
	project, err := s.discussionProject(projectPublicID, shareToken, viewerID)
	if err != nil {
		return nil, err
	}
	title, body, err := normalizeDiscussionThread(input.Title, input.Body)
	if err != nil {
		return nil, err
	}
	anchorType, anchorID, err := s.resolveAnchor(project, input.AnchorStory, input.AnchorLore)
	if err != nil {
		return nil, err
	}
	row := &storytellerModel.DiscussionThread{ProjectID: project.ID, AnchorType: anchorType, AnchorID: anchorID}
	preferred, err := s.anchorSigners(row)
	if err != nil {
		return nil, err
	}
	speaker, err := s.discussionSpeakerFor(project, viewerID, preferred)
	if err != nil {
		return nil, err
	}
	key, err := speaker.pick(input.As)
	if err != nil {
		return nil, err
	}
	if !allowSocialWrite("discussion", viewerID, discussionRateLimit, discussionRateWindow) {
		return nil, ErrSocialRateLimited
	}
	row.PublicID, row.UserID, row.ProfileID, row.Title, row.Body = randomID(), key.UserID, key.ProfileID, title, body
	row.LastActivityAt = time.Now()
	if err := s.repo.CreateDiscussionThread(row); err != nil {
		return nil, err
	}
	s.notifyDiscussion(row, nil)
	return &storytellerModel.DiscussionThreadOutput{PublicID: row.PublicID, Title: row.Title}, nil
}

// EditDiscussionThread：發串者本人、串沒有鎖定、沒有被封鎖；舊版本存進編輯歷史。
func (s *Service) EditDiscussionThread(viewerID uint64, threadPublicID string, input storytellerModel.DiscussionThreadEditRequest) error {
	thread, err := s.repo.DiscussionThreadByPublicID(threadPublicID)
	if err != nil {
		return err
	}
	if thread.UserID != viewerID {
		return ErrAuthorPostForbidden
	}
	if thread.LockedAt != nil {
		return ErrDiscussionLocked
	}
	project, err := s.repo.ProjectByID(thread.ProjectID)
	if err != nil {
		return err
	}
	if err := s.ensureNotBlockedInProject(project, viewerID); err != nil {
		return err
	}
	title, body, err := normalizeDiscussionThread(input.Title, input.Body)
	if err != nil {
		return err
	}
	return s.repo.UpdateDiscussionThread(thread.ID, title, body)
}

// ownedDiscussionThread 取串與作品，確認 viewer 是作品作者（鎖定、封鎖發串者用）。
func (s *Service) ownedDiscussionThread(viewerID uint64, threadPublicID string) (*storytellerModel.DiscussionThread, *storytellerModel.Project, error) {
	thread, err := s.repo.DiscussionThreadByPublicID(threadPublicID)
	if err != nil {
		return nil, nil, err
	}
	project, err := s.repo.ProjectByID(thread.ProjectID)
	if err != nil {
		return nil, nil, err
	}
	if project.UserID != viewerID {
		return nil, nil, ErrAuthorPostForbidden
	}
	return thread, project, nil
}

// DeleteDiscussionThread：發串者本人或作品作者；整串連同回覆都看不到。
func (s *Service) DeleteDiscussionThread(viewerID uint64, threadPublicID string) error {
	thread, err := s.repo.DiscussionThreadByPublicID(threadPublicID)
	if err != nil {
		return err
	}
	if thread.UserID != viewerID {
		project, err := s.repo.ProjectByID(thread.ProjectID)
		if err != nil {
			return err
		}
		if project.UserID != viewerID {
			return ErrAuthorPostForbidden
		}
	}
	return s.repo.SoftDeleteDiscussionThread(thread.ID)
}

func (s *Service) SetDiscussionThreadLocked(viewerID uint64, threadPublicID string, locked bool) error {
	thread, _, err := s.ownedDiscussionThread(viewerID, threadPublicID)
	if err != nil {
		return err
	}
	return s.repo.SetDiscussionThreadLocked(thread.ID, locked)
}

// BlockDiscussionStarter 從串的「⋯ → 封鎖發串者」進來。
func (s *Service) BlockDiscussionStarter(viewerID uint64, threadPublicID string) error {
	thread, project, err := s.ownedDiscussionThread(viewerID, threadPublicID)
	if err != nil {
		return err
	}
	if thread.UserID == viewerID {
		return ErrCannotBlockSelf
	}
	return s.blockInProject(project, thread.UserID)
}

func (s *Service) CreateDiscussionComment(viewerID uint64, threadPublicID, shareToken string, input storytellerModel.CommentRequest) (*storytellerModel.CommentOutput, error) {
	thread, project, err := s.discussionThread(threadPublicID, shareToken, viewerID)
	if err != nil {
		return nil, err
	}
	if thread.LockedAt != nil {
		return nil, ErrDiscussionLocked
	}
	preferred, err := s.anchorSigners(thread)
	if err != nil {
		return nil, err
	}
	speaker, err := s.discussionSpeakerFor(project, viewerID, preferred)
	if err != nil {
		return nil, err
	}
	key, err := speaker.pick(input.As)
	if err != nil {
		return nil, err
	}
	body, err := normalizePostBody(input.Body, "留言內容", storytellerModel.DiscussionCommentMaxRunes)
	if err != nil {
		return nil, err
	}
	parent, replyTo, err := s.replyTargets(storytellerModel.CommentTargetDiscussionThread, thread.ID, strings.TrimSpace(input.Parent), strings.TrimSpace(input.ReplyTo))
	if err != nil {
		return nil, err
	}
	if !allowSocialWrite("comment", viewerID, commentRateLimit, commentRateWindow) {
		return nil, ErrSocialRateLimited
	}
	row := &storytellerModel.Comment{
		PublicID: randomID(), TargetType: storytellerModel.CommentTargetDiscussionThread, TargetID: thread.ID,
		UserID: key.UserID, ProfileID: key.ProfileID, Body: body,
	}
	if parent != nil {
		row.ParentID = parent.ID
	}
	if replyTo != nil {
		row.ReplyToID = replyTo.ID
	}
	if err := s.repo.CreateComment(row); err != nil {
		return nil, err
	}
	if err := s.repo.TouchDiscussionThread(thread.ID); err != nil {
		return nil, err
	}
	s.notifyDiscussion(thread, row)
	return &storytellerModel.CommentOutput{PublicID: row.PublicID}, nil
}
