package storyteller

import (
	"errors"
	"strings"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"gorm.io/gorm"
)

// 作者動態的留言。留言身份由後端決定、前端不傳：在自己某個身份的貼文底下就用該貼文的身份
// （P 的貼文底下就是 P 在回），其他地方一律本人身份，且本人必須設定筆名。

var (
	// ErrCommentPenNameRequired：本人沒有筆名不能留言（不能退回 display name／email）
	ErrCommentPenNameRequired = errors.New("comment requires a pen name")
	// ErrCommentBlocked：被這則貼文的身份封鎖
	ErrCommentBlocked = errors.New("comment blocked by author")
	// ErrInvalidReplyTarget：回覆的留言不存在、已刪除，或不在同一則貼文／同一串
	ErrInvalidReplyTarget = PostValidationError("回覆的留言不存在或已刪除")
	// ErrCannotBlockSelf：不能封鎖自己
	ErrCannotBlockSelf = PostValidationError("不能封鎖自己")
)

// commentViewerState 決定看貼文的人能不能留言、用哪個身份；純函式，詳情頁與建立留言共用。
func commentViewerState(viewerID uint64, postKey storytellerModel.AuthorIdentityKey, hasPenName, blocked bool) (storytellerModel.AuthorIdentityKey, storytellerModel.CommentViewerState) {
	switch {
	case viewerID == 0:
		return storytellerModel.AuthorIdentityKey{}, storytellerModel.CommentViewerLoginRequired
	case viewerID == postKey.UserID:
		return postKey, storytellerModel.CommentViewerCanComment
	case blocked:
		return storytellerModel.AuthorIdentityKey{}, storytellerModel.CommentViewerBlocked
	case !hasPenName:
		return storytellerModel.AuthorIdentityKey{}, storytellerModel.CommentViewerNeedPenName
	default:
		return storytellerModel.AuthorIdentityKey{UserID: viewerID}, storytellerModel.CommentViewerCanComment
	}
}

// commentContext 查 viewer 是否有筆名、是否被這則貼文的身份封鎖。
func (s *Service) commentContext(viewerID uint64, post *storytellerModel.AuthorPost) (storytellerModel.AuthorIdentityKey, storytellerModel.CommentViewerState, error) {
	if viewerID == 0 || viewerID == post.UserID {
		key, state := commentViewerState(viewerID, post.Identity(), false, false)
		return key, state, nil
	}
	blocked, err := s.repo.BlockedUserIDs(post.UserID, post.ProfileID, []uint64{viewerID})
	if err != nil {
		return storytellerModel.AuthorIdentityKey{}, "", err
	}
	profile, err := s.repo.UserProfile(viewerID)
	if err != nil {
		return storytellerModel.AuthorIdentityKey{}, "", err
	}
	key, state := commentViewerState(viewerID, post.Identity(), strings.TrimSpace(profile.PenName) != "", blocked[viewerID])
	return key, state, nil
}

// replyTargets 驗證 parent／reply_to：parent 必須是同一則貼文的頂層留言，reply_to 必須是同一串的回覆；
// reply_to 等於 parent 本身時視同回覆整串。
func (s *Service) replyTargets(post *storytellerModel.AuthorPost, parentPublicID, replyToPublicID string) (*storytellerModel.Comment, *storytellerModel.Comment, error) {
	if parentPublicID == "" {
		if replyToPublicID != "" {
			return nil, nil, ErrInvalidReplyTarget
		}
		return nil, nil, nil
	}
	lookup := func(publicID string) (*storytellerModel.Comment, error) {
		comment, err := s.repo.CommentByPublicID(publicID)
		if errors.Is(err, gorm.ErrRecordNotFound) || (err == nil && (comment.TargetType != storytellerModel.CommentTargetAuthorPost || comment.TargetID != post.ID)) {
			return nil, ErrInvalidReplyTarget
		}
		return comment, err
	}
	parent, err := lookup(parentPublicID)
	if err != nil {
		return nil, nil, err
	}
	if parent.ParentID != 0 {
		return nil, nil, ErrInvalidReplyTarget
	}
	if replyToPublicID == "" || replyToPublicID == parentPublicID {
		return parent, nil, nil
	}
	replyTo, err := lookup(replyToPublicID)
	if err != nil {
		return nil, nil, err
	}
	if replyTo.ParentID != parent.ID {
		return nil, nil, ErrInvalidReplyTarget
	}
	return parent, replyTo, nil
}

func (s *Service) CreateComment(viewerID uint64, postPublicID string, input storytellerModel.CommentRequest) (*storytellerModel.CommentOutput, error) {
	post, err := s.repo.AuthorPostByPublicID(postPublicID)
	if err != nil {
		return nil, err
	}
	key, state, err := s.commentContext(viewerID, post)
	if err != nil {
		return nil, err
	}
	switch state {
	case storytellerModel.CommentViewerBlocked:
		return nil, ErrCommentBlocked
	case storytellerModel.CommentViewerNeedPenName:
		return nil, ErrCommentPenNameRequired
	}
	body, err := normalizePostBody(input.Body, "留言內容", storytellerModel.CommentBodyMaxRunes)
	if err != nil {
		return nil, err
	}
	parent, replyTo, err := s.replyTargets(post, strings.TrimSpace(input.Parent), strings.TrimSpace(input.ReplyTo))
	if err != nil {
		return nil, err
	}
	if !allowSocialWrite("comment", viewerID, commentRateLimit, commentRateWindow) {
		return nil, ErrSocialRateLimited
	}
	row := &storytellerModel.Comment{
		PublicID: randomID(), TargetType: storytellerModel.CommentTargetAuthorPost, TargetID: post.ID,
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
	s.notifyComment(post, row, parent, replyTo)
	return &storytellerModel.CommentOutput{PublicID: row.PublicID}, nil
}

// commentWithPost 取未刪除的留言與它所在的貼文。
func (s *Service) commentWithPost(commentPublicID string) (*storytellerModel.Comment, *storytellerModel.AuthorPost, error) {
	comment, err := s.repo.CommentByPublicID(commentPublicID)
	if err != nil {
		return nil, nil, err
	}
	post, err := s.repo.AuthorPostByID(comment.TargetID)
	return comment, post, err
}

// DeleteComment：留言者本人，或貼文擁有者（管自己的版面）可刪；一律 soft delete、前端留佔位。
func (s *Service) DeleteComment(viewerID uint64, commentPublicID string) error {
	comment, post, err := s.commentWithPost(commentPublicID)
	if err != nil {
		return err
	}
	if comment.UserID != viewerID && post.UserID != viewerID {
		return ErrAuthorPostForbidden
	}
	return s.repo.SoftDeleteComment(comment.ID)
}

// AuthorPostDetail 是貼文單頁：貼文＋整串留言（含刪除佔位）＋看的人能不能留言。
func (s *Service) AuthorPostDetail(postPublicID string, viewerID uint64) (*storytellerModel.AuthorPostDetailOutput, error) {
	post, err := s.repo.AuthorPostByPublicID(postPublicID)
	if err != nil {
		return nil, err
	}
	comments, err := s.repo.CommentsByTarget(storytellerModel.CommentTargetAuthorPost, post.ID)
	if err != nil {
		return nil, err
	}
	keys := []storytellerModel.AuthorIdentityKey{post.Identity(), {UserID: viewerID}}
	commenterIDs := make([]uint64, 0, len(comments))
	for _, comment := range comments {
		keys = append(keys, comment.Identity())
		commenterIDs = append(commenterIDs, comment.UserID)
	}
	book, err := loadIdentityBook(s.repo, keys)
	if err != nil {
		return nil, err
	}
	// 貼文身份已不存在（筆名刪了、本人清掉筆名）就當作貼文不存在
	author, ok := book.lookup(post.Identity())
	if !ok {
		return nil, gorm.ErrRecordNotFound
	}
	posts, err := s.authorPostOutputs(post.Identity(), author, []storytellerModel.AuthorPost{*post}, viewerID)
	if err != nil {
		return nil, err
	}
	commentAs, state, err := s.commentContext(viewerID, post)
	if err != nil {
		return nil, err
	}
	blocked := map[uint64]bool{}
	if viewerID != 0 && viewerID == post.UserID {
		if blocked, err = s.repo.BlockedUserIDs(post.UserID, post.ProfileID, uniqueUint64(commenterIDs)); err != nil {
			return nil, err
		}
	}
	output := &storytellerModel.AuthorPostDetailOutput{
		Post: posts[0], Comments: buildCommentThreads(comments, book, post.Identity(), viewerID, blocked), CommentState: state,
	}
	if state == storytellerModel.CommentViewerCanComment {
		output.CommentAs = book.displayName(commentAs)
	}
	return output, nil
}

// buildCommentThreads 把平的留言列組成兩層：頂層依時間排序，回覆掛在所屬頂層底下。
func buildCommentThreads(rows []storytellerModel.Comment, book *identityBook, postKey storytellerModel.AuthorIdentityKey, viewerID uint64, blocked map[uint64]bool) []storytellerModel.CommentOutput {
	isOwner := viewerID != 0 && viewerID == postKey.UserID
	byID := make(map[uint64]*storytellerModel.Comment, len(rows))
	for i := range rows {
		byID[rows[i].ID] = &rows[i]
	}
	output := func(row *storytellerModel.Comment) storytellerModel.CommentOutput {
		if row.IsDeleted {
			return storytellerModel.CommentOutput{PublicID: row.PublicID, Deleted: true}
		}
		createdAt := row.CreatedAt
		out := storytellerModel.CommentOutput{
			PublicID: row.PublicID, Body: row.Body, IsPostAuthor: row.Identity() == postKey, CreatedAt: &createdAt,
			CanDelete: viewerID != 0 && (row.UserID == viewerID || isOwner),
			Blocked:   isOwner && blocked[row.UserID],
		}
		out.CanBlock = isOwner && row.UserID != postKey.UserID && !out.Blocked
		// 留言者身份已不存在時 Author 留 nil，前端顯示「已不存在的使用者」、不給連結
		if identity, ok := book.lookup(row.Identity()); ok {
			out.Author = &identity
		}
		if row.ReplyToID != 0 {
			target := byID[row.ReplyToID]
			out.ReplyTo = &storytellerModel.CommentReplyToOutput{Deleted: true}
			if target != nil && !target.IsDeleted {
				out.ReplyTo = &storytellerModel.CommentReplyToOutput{PublicID: target.PublicID, PenName: book.displayName(target.Identity())}
			}
		}
		return out
	}
	threads := make([]storytellerModel.CommentOutput, 0)
	index := make(map[uint64]int)
	for i := range rows {
		row := &rows[i]
		if row.ParentID == 0 {
			index[row.ID] = len(threads)
			threads = append(threads, output(row))
		} else if at, ok := index[row.ParentID]; ok {
			threads[at].Replies = append(threads[at].Replies, output(row))
		}
	}
	return threads
}
