package storyteller

import (
	"fmt"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	storytellerRepo "faryne.dev/repository/storyteller"
	notifyService "faryne.dev/service/storytellernotify"
)

// 作者動態的通知：留言／回覆（同步發送，附屬動作失敗只記 log）與「發了新動態」（排程掃描）。

// postedNotificationPostLimit 是「發了新動態」通知快照最多列幾則
const postedNotificationPostLimit = 10

// taipeiZone 決定「每天最多一則」的日界線；用固定時區，不依賴主機時區或 tzdata。
var taipeiZone = time.FixedZone("Asia/Taipei", 8*60*60)

type commentRecipient struct {
	UserID uint64
	Kind   storytellerModel.NotificationKind
	// OwnComment 是收件人自己被回覆的那則留言（post.commented 為 nil）
	OwnComment *storytellerModel.Comment
}

// commentRecipients 決定一則留言要通知誰：被回覆的頂層留言者與 reply_to 那則的留言者收 post.replied，
// 貼文擁有者若不在其中收 post.commented；同一帳號只收一則（優先 replied），自己不通知自己。
func commentRecipients(postOwnerID uint64, comment, parent, replyTo *storytellerModel.Comment) []commentRecipient {
	recipients := make([]commentRecipient, 0, 3)
	seen := map[uint64]bool{comment.UserID: true}
	add := func(userID uint64, kind storytellerModel.NotificationKind, own *storytellerModel.Comment) {
		if !seen[userID] {
			seen[userID] = true
			recipients = append(recipients, commentRecipient{UserID: userID, Kind: kind, OwnComment: own})
		}
	}
	if replyTo != nil {
		add(replyTo.UserID, storytellerModel.NotificationKindPostReplied, replyTo)
	}
	if parent != nil {
		add(parent.UserID, storytellerModel.NotificationKindPostReplied, parent)
	}
	add(postOwnerID, storytellerModel.NotificationKindPostCommented, nil)
	return recipients
}

// commentNotificationInputs 組留言通知；摘要都先遮蔽劇透／R18。
func commentNotificationInputs(post *storytellerModel.AuthorPost, comment, parent, replyTo *storytellerModel.Comment, book *identityBook) []notifyService.Input {
	actor := comment.Identity()
	name, postAuthor := book.displayName(actor), book.displayName(post.Identity())
	thread := comment.PublicID
	if parent != nil {
		thread = parent.PublicID
	}
	inputs := make([]notifyService.Input, 0, 3)
	for _, recipient := range commentRecipients(post.UserID, comment, parent, replyTo) {
		payload := storytellerModel.NotificationPayload{
			Body: postExcerpt(comment.Body), Actor: book.snapshot(actor),
			PostPublicID: post.PublicID, PostAuthor: postAuthor, PostExcerpt: postExcerpt(post.Body),
			CommentPublicID: comment.PublicID, CommentExcerpt: postExcerpt(comment.Body), ThreadPublicID: thread,
			Internal: &storytellerModel.NotificationInternal{ActorUserID: actor.UserID, ActorProfileID: actor.ProfileID, TargetProfileID: post.ProfileID},
		}
		switch {
		case recipient.Kind == storytellerModel.NotificationKindPostReplied:
			payload.Title, payload.ParentExcerpt = name+" 回覆了你的留言", postExcerpt(recipient.OwnComment.Body)
		case post.ProfileID != 0:
			payload.Title, payload.TargetPenName = fmt.Sprintf("%s 留言了你的筆名 %s 的貼文", name, postAuthor), postAuthor
		default:
			payload.Title = name + " 留言了你的貼文"
		}
		inputs = append(inputs, notifyService.Input{
			UserID: recipient.UserID, Kind: recipient.Kind, Payload: payload,
			GroupKey: fmt.Sprintf("%s:%s", recipient.Kind, comment.PublicID),
		})
	}
	return inputs
}

// notifyComment 是留言的附屬動作：送不出去只記 log，不影響留言本身。
func (s *Service) notifyComment(post *storytellerModel.AuthorPost, comment, parent, replyTo *storytellerModel.Comment) {
	keys := []storytellerModel.AuthorIdentityKey{comment.Identity(), post.Identity()}
	book, err := loadIdentityBook(s.repo, keys)
	if err != nil {
		sendFollowNotification(notifyService.Input{Kind: storytellerModel.NotificationKindPostCommented, UserID: post.UserID}, err)
		return
	}
	inputs := commentNotificationInputs(post, comment, parent, replyTo, book)
	if len(inputs) == 0 {
		return
	}
	if err := notifyService.NewService().Notify(inputs); err != nil {
		sendFollowNotification(inputs[0], err)
	}
}

// ---- 發了新動態（排程） ----

type authorPostScanStats struct {
	Posts         int
	Notifications int
}

// postedNotificationPayload 組「發了新動態」通知：同一身份每天一個 group_key，當天之後的貼文
// INSERT IGNORE 不會再跳通知。
// works 是貼文 id → 作品卡名稱（見 postWorkLabels）。
func postedNotificationPayload(key storytellerModel.AuthorIdentityKey, posts []storytellerModel.AuthorPost, book *identityBook, works map[uint64]string) storytellerModel.NotificationPayload {
	name := book.displayName(key)
	payload := storytellerModel.NotificationPayload{
		Title: name + " 發了新動態", Body: postExcerpt(posts[0].Body), Actor: book.snapshot(key), PostAuthor: name,
		Internal: &storytellerModel.NotificationInternal{ActorUserID: key.UserID, ActorProfileID: key.ProfileID},
	}
	if len(posts) > 1 {
		payload.Title = fmt.Sprintf("%s 發了 %d 則新動態", name, len(posts))
	}
	for _, post := range posts[:min(len(posts), postedNotificationPostLimit)] {
		payload.Posts = append(payload.Posts, storytellerModel.NotificationPost{PublicID: post.PublicID, Excerpt: postExcerpt(post.Body), Work: works[post.ID]})
	}
	return payload
}

// workLabel 是作品卡的純文字名稱：「《作品》」，附某一話時接「冊・話」。
func workLabel(projectName string, story *storytellerRepo.IdentityStoryRef) string {
	label := "《" + projectName + "》"
	if story == nil {
		return label
	}
	if story.VolumeTitle != "" {
		return label + " " + story.VolumeTitle + "・" + story.Title
	}
	return label + " " + story.Title
}

// postWorkLabels 查這批貼文附的作品卡名稱；掃描當下已不可見（轉私密、下架）的作品不列。
func (s *Service) postWorkLabels(key storytellerModel.AuthorIdentityKey, posts []storytellerModel.AuthorPost) (map[uint64]string, error) {
	labels := make(map[uint64]string)
	projectIDs := make([]uint64, 0)
	for _, post := range posts {
		if post.AttachProjectID != 0 {
			projectIDs = append(projectIDs, post.AttachProjectID)
		}
	}
	if len(projectIDs) == 0 {
		return labels, nil
	}
	projectIDs = uniqueUint64(projectIDs)
	refs, err := s.repo.IdentityVisibleStoryRefs(key.UserID, key.ProfileID, projectIDs)
	if err != nil {
		return nil, err
	}
	projects, err := s.repo.ProjectsByIDs(projectIDs)
	if err != nil {
		return nil, err
	}
	visible, stories, names := map[uint64]bool{}, map[uint64]*storytellerRepo.IdentityStoryRef{}, map[uint64]string{}
	for i := range refs {
		visible[refs[i].ProjectID] = true
		stories[refs[i].ID] = &refs[i]
	}
	for _, project := range projects {
		names[project.ID] = project.Name
	}
	for _, post := range posts {
		story := stories[post.AttachStoryID]
		if post.AttachProjectID == 0 || !visible[post.AttachProjectID] || (post.AttachStoryID != 0 && story == nil) {
			continue
		}
		if post.AttachStoryID == 0 {
			story = nil
		}
		labels[post.ID] = workLabel(names[post.AttachProjectID], story)
	}
	return labels, nil
}

func postedGroupKey(key storytellerModel.AuthorIdentityKey, now time.Time) string {
	return fmt.Sprintf("%s:%d:%d:%s", storytellerModel.NotificationKindAuthorPosted, key.UserID, key.ProfileID, now.In(taipeiZone).Format("2006-01-02"))
}

// scanAuthorPosts 併在新話通知掃描裡跑：撈還沒通知過的貼文，依身份聚合後通知追蹤這個身份的帳號。
// 身份已不存在的貼文照樣標成已處理（不發通知），避免每輪重撈。
func (s *Service) scanAuthorPosts() (authorPostScanStats, error) {
	var stats authorPostScanStats
	posts, err := s.repo.AuthorPostsToNotify(publishScanLimit)
	if err != nil {
		return stats, err
	}
	now := time.Now()
	for start := 0; start < len(posts); {
		key, end := posts[start].Identity(), start
		for end < len(posts) && posts[end].Identity() == key {
			end++
		}
		batch := posts[start:end]
		start = end
		ids := make([]uint64, 0, len(batch))
		for _, post := range batch {
			ids = append(ids, post.ID)
		}
		rows, err := s.postedNotificationRows(key, batch, now)
		if err != nil {
			return stats, err
		}
		claimed, err := s.repo.ClaimAuthorPosts(ids, rows)
		if err != nil {
			return stats, err
		}
		if claimed {
			stats.Posts += len(batch)
			stats.Notifications += len(rows)
		}
	}
	return stats, nil
}

func (s *Service) postedNotificationRows(key storytellerModel.AuthorIdentityKey, batch []storytellerModel.AuthorPost, now time.Time) ([]*storytellerModel.Notification, error) {
	book, err := loadIdentityBook(s.repo, []storytellerModel.AuthorIdentityKey{key})
	if err != nil {
		return nil, err
	}
	if _, ok := book.lookup(key); !ok {
		return nil, nil
	}
	followers, err := s.repo.IdentityFollowers(key.UserID, key.ProfileID)
	if err != nil {
		return nil, err
	}
	works, err := s.postWorkLabels(key, batch)
	if err != nil {
		return nil, err
	}
	payload, groupKey := postedNotificationPayload(key, batch, book, works), postedGroupKey(key, now)
	inputs := make([]notifyService.Input, 0, len(followers))
	for _, userID := range followers {
		if userID != key.UserID {
			inputs = append(inputs, notifyService.Input{UserID: userID, Kind: storytellerModel.NotificationKindAuthorPosted, GroupKey: groupKey, Payload: payload})
		}
	}
	return notifyService.NewRows(inputs)
}

// ---- 輸出前補資料 ----

func isPostNotificationKind(kind storytellerModel.NotificationKind) bool {
	switch kind {
	case storytellerModel.NotificationKindAuthorPosted, storytellerModel.NotificationKindPostCommented, storytellerModel.NotificationKindPostReplied:
		return true
	}
	return false
}

// decoratePostNotifications 把留言者／作者換成目前的筆名，並標出已刪除的貼文或留言。
// 一頁通知固定幾次批次查詢：貼文、留言、身份資料。
func (s *Service) decoratePostNotifications(rows []storytellerModel.Notification, outs []storytellerModel.NotificationOutput) error {
	postIDs, commentIDs := make([]string, 0), make([]string, 0)
	for _, row := range rows {
		if !isPostNotificationKind(row.Kind) || row.Payload.Internal == nil {
			continue
		}
		commentIDs = append(commentIDs, row.Payload.CommentPublicID)
		postIDs = append(postIDs, row.Payload.PostPublicID)
		for _, post := range row.Payload.Posts {
			postIDs = append(postIDs, post.PublicID)
		}
	}
	if len(postIDs) == 0 {
		return nil
	}
	posts, err := s.repo.AuthorPostsByPublicIDs(postIDs)
	if err != nil {
		return err
	}
	comments, err := s.repo.CommentsByPublicIDs(commentIDs)
	if err != nil {
		return err
	}
	livePosts, liveComments := map[string]*storytellerModel.AuthorPost{}, map[string]bool{}
	keys := make([]storytellerModel.AuthorIdentityKey, 0, len(rows)+len(posts))
	for i, post := range posts {
		if !post.IsDeleted {
			livePosts[post.PublicID] = &posts[i]
			keys = append(keys, post.Identity())
		}
	}
	for _, comment := range comments {
		liveComments[comment.PublicID] = !comment.IsDeleted
	}
	for _, row := range rows {
		if isPostNotificationKind(row.Kind) && row.Payload.Internal != nil {
			keys = append(keys, storytellerModel.AuthorIdentityKey{UserID: row.Payload.Internal.ActorUserID, ProfileID: row.Payload.Internal.ActorProfileID})
		}
	}
	book, err := loadIdentityBook(s.repo, keys)
	if err != nil {
		return err
	}
	for i, row := range rows {
		if !isPostNotificationKind(row.Kind) || row.Payload.Internal == nil {
			continue
		}
		payload := &outs[i].Payload
		payload.Actor = nil
		if actor, ok := book.lookup(storytellerModel.AuthorIdentityKey{UserID: row.Payload.Internal.ActorUserID, ProfileID: row.Payload.Internal.ActorProfileID}); ok {
			payload.Actor = &actor
			if row.Kind == storytellerModel.NotificationKindAuthorPosted {
				payload.PostAuthor = actor.PenName
			}
		}
		if row.Kind == storytellerModel.NotificationKindAuthorPosted {
			live := payload.Posts[:0:0]
			for _, post := range payload.Posts {
				if livePosts[post.PublicID] != nil {
					live = append(live, post)
				}
			}
			payload.Posts, payload.Deleted = live, len(live) == 0
			continue
		}
		post := livePosts[row.Payload.PostPublicID]
		payload.Deleted = post == nil || !liveComments[row.Payload.CommentPublicID]
		if post != nil {
			if identity, ok := book.lookup(post.Identity()); ok {
				payload.PostAuthor = identity.PenName
				if payload.TargetPenName != "" {
					payload.TargetPenName = identity.PenName
				}
			}
		}
	}
	return nil
}
