package storyteller

import (
	storytellerModel "faryne.dev/model/entity/storyteller"
)

// 討論版的讀取：列表（討論分頁、閱讀頁 modal）與單串詳情（展開一串）。

// ListDiscussionThreads：指定 anchor_story／anchor_lore 時只列錨定在那一話／那篇設定的串（閱讀頁 modal），
// 否則依篩選列出全部（作品頁討論分頁）。錨點已不可見時回空列表。
func (s *Service) ListDiscussionThreads(viewerID uint64, projectPublicID string, query storytellerModel.DiscussionListQuery) (*storytellerModel.DiscussionListOutput, error) {
	project, err := s.discussionProject(projectPublicID, query.Share, viewerID)
	if err != nil {
		return nil, err
	}
	page := max(query.Page, 1)
	anchorType, anchorID := storytellerModel.DiscussionAnchorNone, uint64(0)
	if query.AnchorStory != "" || query.AnchorLore != "" {
		if anchorType, anchorID, err = s.resolveAnchor(project, query.AnchorStory, query.AnchorLore); err != nil {
			if _, invalid := err.(PostValidationError); invalid {
				return &storytellerModel.DiscussionListOutput{Items: []storytellerModel.DiscussionThreadOutput{}, Page: page}, nil
			}
			return nil, err
		}
	}
	rows, total, err := s.repo.DiscussionThreads(project.ID, query.Filter, anchorType, anchorID, query.Sort,
		(page-1)*storytellerModel.DiscussionPageSize, storytellerModel.DiscussionPageSize)
	if err != nil {
		return nil, err
	}
	var preferred []uint64
	if anchorType == storytellerModel.DiscussionAnchorStory {
		if preferred, err = s.anchorSigners(&storytellerModel.DiscussionThread{AnchorType: anchorType, AnchorID: anchorID}); err != nil {
			return nil, err
		}
	}
	speaker, err := s.discussionSpeakerFor(project, viewerID, preferred)
	if err != nil {
		return nil, err
	}
	items, err := s.discussionThreadOutputs(project, rows, viewerID, speaker, false)
	if err != nil {
		return nil, err
	}
	return &storytellerModel.DiscussionListOutput{Items: items, Total: total, Page: page, Viewer: speaker.output()}, nil
}

// DiscussionThreadDetail 是展開一串：開頭內文＋整串留言（含刪除佔位）＋看的人能不能發言、用哪些身份。
func (s *Service) DiscussionThreadDetail(viewerID uint64, threadPublicID, shareToken string) (*storytellerModel.DiscussionThreadDetailOutput, error) {
	thread, project, err := s.discussionThread(threadPublicID, shareToken, viewerID)
	if err != nil {
		return nil, err
	}
	preferred, err := s.anchorSigners(thread)
	if err != nil {
		return nil, err
	}
	speaker, err := s.discussionSpeakerFor(project, viewerID, preferred)
	if err != nil {
		return nil, err
	}
	outputs, err := s.discussionThreadOutputs(project, []storytellerModel.DiscussionThread{*thread}, viewerID, speaker, true)
	if err != nil {
		return nil, err
	}
	comments, err := s.repo.CommentsByTarget(storytellerModel.CommentTargetDiscussionThread, thread.ID)
	if err != nil {
		return nil, err
	}
	keys := make([]storytellerModel.AuthorIdentityKey, 0, len(comments))
	commenterIDs := make([]uint64, 0, len(comments))
	for _, comment := range comments {
		keys = append(keys, comment.Identity())
		commenterIDs = append(commenterIDs, comment.UserID)
	}
	book, err := loadIdentityBook(s.repo, keys)
	if err != nil {
		return nil, err
	}
	blocked, err := s.ownerBlockedMap(project, viewerID, commenterIDs)
	if err != nil {
		return nil, err
	}
	scope := commentScope{
		OwnerID:  project.UserID,
		IsAuthor: func(c *storytellerModel.Comment) bool { return c.UserID == project.UserID },
		Editable: thread.LockedAt == nil && !speaker.Blocked,
	}
	return &storytellerModel.DiscussionThreadDetailOutput{
		Thread: outputs[0], Comments: buildCommentThreads(comments, book, scope, viewerID, blocked), Viewer: speaker.output(),
	}, nil
}

// ownerBlockedMap：只有作品作者看得到誰被封鎖了（被作品任一署名身份封鎖都算）。
func (s *Service) ownerBlockedMap(project *storytellerModel.Project, viewerID uint64, userIDs []uint64) (map[uint64]bool, error) {
	if viewerID == 0 || viewerID != project.UserID {
		return map[uint64]bool{}, nil
	}
	signing, err := s.projectSigning(project)
	if err != nil {
		return nil, err
	}
	return s.repo.BlockedByAnyIdentity(project.UserID, signing, uniqueUint64(userIDs))
}

// discussionThreadOutputs 組一批串：身份、回覆數、錨點、權限都是固定次數的批次查詢。
func (s *Service) discussionThreadOutputs(project *storytellerModel.Project, rows []storytellerModel.DiscussionThread, viewerID uint64, speaker *discussionSpeaker, withBody bool) ([]storytellerModel.DiscussionThreadOutput, error) {
	ids, keys, starterIDs, storyIDs, loreIDs := make([]uint64, 0, len(rows)), make([]storytellerModel.AuthorIdentityKey, 0, len(rows)), make([]uint64, 0, len(rows)), make([]uint64, 0), make([]uint64, 0)
	for _, row := range rows {
		ids, keys, starterIDs = append(ids, row.ID), append(keys, row.Identity()), append(starterIDs, row.UserID)
		switch row.AnchorType {
		case storytellerModel.DiscussionAnchorStory:
			storyIDs = append(storyIDs, row.AnchorID)
		case storytellerModel.DiscussionAnchorLore:
			loreIDs = append(loreIDs, row.AnchorID)
		}
	}
	book, err := loadIdentityBook(s.repo, keys)
	if err != nil {
		return nil, err
	}
	counts, err := s.repo.CommentCounts(storytellerModel.CommentTargetDiscussionThread, ids)
	if err != nil {
		return nil, err
	}
	anchors, err := s.discussionAnchors(project.ID, uniqueUint64(storyIDs), uniqueUint64(loreIDs))
	if err != nil {
		return nil, err
	}
	blocked, err := s.ownerBlockedMap(project, viewerID, starterIDs)
	if err != nil {
		return nil, err
	}
	isOwner := viewerID != 0 && viewerID == project.UserID
	outputs := make([]storytellerModel.DiscussionThreadOutput, 0, len(rows))
	for _, row := range rows {
		out := storytellerModel.DiscussionThreadOutput{
			PublicID: row.PublicID, Title: row.Title, IsProjectAuthor: row.UserID == project.UserID,
			ReplyCount: counts[row.ID], Edited: row.EditedAt != nil, Locked: row.LockedAt != nil,
			CanEdit:   viewerID != 0 && row.UserID == viewerID && row.LockedAt == nil && !speaker.Blocked,
			CanDelete: viewerID != 0 && (row.UserID == viewerID || isOwner),
			CanLock:   isOwner, Blocked: isOwner && blocked[row.UserID],
			IsMine:         viewerID != 0 && row.UserID == viewerID,
			LastActivityAt: row.LastActivityAt, CreatedAt: row.CreatedAt,
		}
		out.CanBlock = isOwner && row.UserID != project.UserID && !out.Blocked
		if withBody {
			out.Body = row.Body
		}
		if identity, ok := book.lookup(row.Identity()); ok {
			out.Author = &identity
		}
		if row.AnchorType != storytellerModel.DiscussionAnchorNone {
			out.Anchor = anchors[anchorKey{row.AnchorType, row.AnchorID}]
			if out.Anchor == nil {
				out.Anchor = &storytellerModel.DiscussionAnchorOutput{Type: row.AnchorType, Unavailable: true}
			}
		}
		outputs = append(outputs, out)
	}
	return outputs, nil
}

type anchorKey struct {
	Type storytellerModel.DiscussionAnchorType
	ID   uint64
}

// discussionAnchors 即時查錨點：話下架、設定轉草稿或刪除後就查不到，輸出 Unavailable。
func (s *Service) discussionAnchors(projectID uint64, storyIDs, loreIDs []uint64) (map[anchorKey]*storytellerModel.DiscussionAnchorOutput, error) {
	result := make(map[anchorKey]*storytellerModel.DiscussionAnchorOutput)
	stories, err := s.repo.VisibleStoryRefs(projectID, storyIDs, nil)
	if err != nil {
		return nil, err
	}
	for _, story := range stories {
		result[anchorKey{storytellerModel.DiscussionAnchorStory, story.ID}] = &storytellerModel.DiscussionAnchorOutput{
			Type: storytellerModel.DiscussionAnchorStory, PublicID: story.PublicID, Title: story.Title, VolumeTitle: story.VolumeTitle,
		}
	}
	lores, err := s.repo.VisibleLoreRefs(projectID, loreIDs, nil)
	if err != nil {
		return nil, err
	}
	for _, lore := range lores {
		result[anchorKey{storytellerModel.DiscussionAnchorLore, lore.ID}] = &storytellerModel.DiscussionAnchorOutput{
			Type: storytellerModel.DiscussionAnchorLore, PublicID: lore.PublicID, Title: lore.Title,
		}
	}
	return result, nil
}
