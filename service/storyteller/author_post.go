package storyteller

import (
	"errors"
	"fmt"
	"slices"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/model/enum"
	"faryne.dev/repository"
	storytellerRepo "faryne.dev/repository/storyteller"
	"faryne.dev/service/client"
	"faryne.dev/service/log"
	"go.uber.org/zap"
)

// 作者動態：每個身份（本人或筆名）各自一條時間軸。發文身份＝所在頁面的身份（:pen），
// 不提供身份選擇器；本人時間軸絕不混入筆名貼文（否則等於公開筆名關係）。

var (
	// ErrAuthorPostForbidden：不是這個身份／這則貼文的擁有者
	ErrAuthorPostForbidden = errors.New("author post forbidden")
	// ErrSocialRateLimited：發文或留言太頻繁
	ErrSocialRateLimited = errors.New("social write rate limited")
	// ErrInvalidAttachment：作品卡只能附發文身份署名、目前公開的作品或話
	ErrInvalidAttachment = PostValidationError("只能附上這個身份署名、目前公開的作品")
)

const (
	authorPostRateLimit  = 10
	authorPostRateWindow = time.Hour
	commentRateLimit     = 30
	commentRateWindow    = 10 * time.Minute
	// attachableProjectLimit／attachableStoryLimit 是作品卡候選清單的上限（每部作品列最新的幾話）
	attachableProjectLimit = 100
	attachableStoryLimit   = 50
)

// allowSocialWrite 是發文／留言的頻率限制。Redis 異常時放行並記 log：
// 頻率限制只是防洗版，不能因為 Redis 掛掉就讓整個社群功能不能用。
func allowSocialWrite(kind string, userID uint64, limit int64, window time.Duration) bool {
	key := fmt.Sprintf("storyteller:ratelimit:%s:%d", kind, userID)
	allowed, err := client.AllowFixedWindow(client.GetRedis(enum.RedisDefault), key, limit, window)
	if err != nil {
		log.Logger().Warn("Storyteller social rate limit unavailable, allowing request", zap.String("key", key), zap.Error(err))
		return true
	}
	return allowed
}

// ownedIdentity 解析 :pen 並確認是 viewer 自己的身份。
func (s *Service) ownedIdentity(viewerID uint64, penName string) (*resolvedAuthorIdentity, error) {
	identity, err := s.resolveAuthorIdentityByPenName(penName)
	if err != nil {
		return nil, err
	}
	if viewerID == 0 || identity.UserID != viewerID {
		return nil, ErrAuthorPostForbidden
	}
	return identity, nil
}

// ownedPost 取未刪除的貼文並確認是 viewer 的。
func (s *Service) ownedPost(viewerID uint64, postPublicID string) (*storytellerModel.AuthorPost, error) {
	post, err := s.repo.AuthorPostByPublicID(postPublicID)
	if err != nil {
		return nil, err
	}
	if post.UserID != viewerID {
		return nil, ErrAuthorPostForbidden
	}
	return post, nil
}

func (s *Service) CreateAuthorPost(viewerID uint64, penName string, input storytellerModel.AuthorPostRequest) (*storytellerModel.AuthorPostOutput, error) {
	identity, err := s.ownedIdentity(viewerID, penName)
	if err != nil {
		return nil, err
	}
	body, err := normalizePostBody(input.Body, "動態內容", storytellerModel.AuthorPostBodyMaxRunes)
	if err != nil {
		return nil, err
	}
	key := storytellerModel.AuthorIdentityKey{UserID: identity.UserID, ProfileID: identity.ProfileID}
	projectID, storyID, err := s.resolvePostAttachment(key, input.AttachProjectPublicID, input.AttachStoryPublicID)
	if err != nil {
		return nil, err
	}
	if !allowSocialWrite("post", viewerID, authorPostRateLimit, authorPostRateWindow) {
		return nil, ErrSocialRateLimited
	}
	row := &storytellerModel.AuthorPost{
		PublicID: randomID(), UserID: identity.UserID, ProfileID: identity.ProfileID, Body: body,
		AttachProjectID: projectID, AttachStoryID: storyID,
	}
	if err := s.repo.CreateAuthorPost(row); err != nil {
		return nil, err
	}
	outputs, err := s.authorPostOutputs(key, identity.output(), []storytellerModel.AuthorPost{*row}, viewerID)
	if err != nil {
		return nil, err
	}
	return &outputs[0], nil
}

// resolvePostAttachment 驗證作品卡：作品（與話）必須公開且署名發文身份。附上別的身份的作品
// 就等於公開兩個身份是同一人，所以一定要在後端擋，不能只靠前端的候選清單。
func (s *Service) resolvePostAttachment(key storytellerModel.AuthorIdentityKey, projectPublicID, storyPublicID string) (uint64, uint64, error) {
	if projectPublicID == "" {
		if storyPublicID != "" {
			return 0, 0, ErrInvalidAttachment
		}
		return 0, 0, nil
	}
	project, err := s.repo.ProjectByPublicID(projectPublicID)
	if repository.IsRecordNotFound(err) {
		return 0, 0, ErrInvalidAttachment
	}
	if err != nil {
		return 0, 0, err
	}
	refs, err := s.repo.IdentityVisibleStoryRefs(key.UserID, key.ProfileID, []uint64{project.ID})
	if err != nil {
		return 0, 0, err
	}
	if len(refs) == 0 {
		return 0, 0, ErrInvalidAttachment
	}
	if storyPublicID == "" {
		return project.ID, 0, nil
	}
	index := slices.IndexFunc(refs, func(ref storytellerRepo.IdentityStoryRef) bool { return ref.PublicID == storyPublicID })
	if index < 0 {
		return 0, 0, ErrInvalidAttachment
	}
	return project.ID, refs[index].ID, nil
}

// ListAuthorPosts 是作者頁「動態」分頁：第一頁先放置頂那則，之後依新到舊。
func (s *Service) ListAuthorPosts(penName, cursor string, viewerID uint64) (*storytellerModel.AuthorPostListOutput, error) {
	identity, err := s.resolveAuthorIdentityByPenName(penName)
	if err != nil {
		return nil, err
	}
	key := storytellerModel.AuthorIdentityKey{UserID: identity.UserID, ProfileID: identity.ProfileID}
	posts := make([]storytellerModel.AuthorPost, 0, storytellerModel.AuthorPostPageSize+1)
	if cursor == "" {
		pinned, err := s.repo.PinnedAuthorPost(key.UserID, key.ProfileID)
		if err != nil {
			return nil, err
		}
		if pinned != nil {
			posts = append(posts, *pinned)
		}
	}
	// 多抓一則判斷還有沒有下一頁
	page, err := s.repo.AuthorPostsByIdentity(key.UserID, key.ProfileID, cursor, storytellerModel.AuthorPostPageSize+1)
	if err != nil {
		return nil, err
	}
	nextCursor := ""
	if len(page) > storytellerModel.AuthorPostPageSize {
		page = page[:storytellerModel.AuthorPostPageSize]
		nextCursor = page[len(page)-1].PublicID
	}
	outputs, err := s.authorPostOutputs(key, identity.output(), append(posts, page...), viewerID)
	if err != nil {
		return nil, err
	}
	return &storytellerModel.AuthorPostListOutput{Items: outputs, NextCursor: nextCursor, IsOwner: viewerID != 0 && viewerID == key.UserID}, nil
}

func (s *Service) DeleteAuthorPost(viewerID uint64, postPublicID string) error {
	post, err := s.ownedPost(viewerID, postPublicID)
	if err != nil {
		return err
	}
	return s.repo.SoftDeleteAuthorPost(post.ID)
}

func (s *Service) SetAuthorPostPinned(viewerID uint64, postPublicID string, pinned bool) error {
	post, err := s.ownedPost(viewerID, postPublicID)
	if err != nil {
		return err
	}
	return s.repo.SetAuthorPostPinned(post, pinned)
}

// SetAuthorPostLiked 冪等；被封鎖的人也能按讚（封鎖只擋留言）。
func (s *Service) SetAuthorPostLiked(viewerID uint64, postPublicID string, liked bool) error {
	post, err := s.repo.AuthorPostByPublicID(postPublicID)
	if err != nil {
		return err
	}
	if liked {
		return s.repo.LikeAuthorPost(post.ID, viewerID)
	}
	return s.repo.UnlikeAuthorPost(post.ID, viewerID)
}

// AttachableWorks 是發文框「附上作品」的候選：只列 :pen 這個身份署名、目前公開的作品。
func (s *Service) AttachableWorks(viewerID uint64, penName string) ([]storytellerModel.AttachableWorkOutput, error) {
	identity, err := s.ownedIdentity(viewerID, penName)
	if err != nil {
		return nil, err
	}
	projects, _, err := s.repo.PublicProjectsByIdentity(identity.UserID, identity.ProfileID, 0, attachableProjectLimit)
	if err != nil {
		return nil, err
	}
	projectIDs := make([]uint64, 0, len(projects))
	for _, project := range projects {
		projectIDs = append(projectIDs, project.ID)
	}
	refs, err := s.repo.IdentityVisibleStoryRefs(identity.UserID, identity.ProfileID, projectIDs)
	if err != nil {
		return nil, err
	}
	stories := make(map[uint64][]storytellerModel.AttachableStoryOutput, len(projects))
	for _, ref := range refs {
		if len(stories[ref.ProjectID]) < attachableStoryLimit {
			stories[ref.ProjectID] = append(stories[ref.ProjectID], storytellerModel.AttachableStoryOutput{PublicID: ref.PublicID, Title: ref.Title, VolumeTitle: ref.VolumeTitle})
		}
	}
	outputs := make([]storytellerModel.AttachableWorkOutput, 0, len(projects))
	for _, project := range projects {
		outputs = append(outputs, storytellerModel.AttachableWorkOutput{
			ProjectPublicID: project.PublicID, ProjectName: project.Name, Rating: project.Rating,
			Stories: append([]storytellerModel.AttachableStoryOutput{}, stories[project.ID]...),
		})
	}
	return outputs, nil
}

// authorPostOutputs 組一批同一身份的貼文：讚數、留言數、我有沒有按讚、作品卡都是固定次數的批次查詢。
func (s *Service) authorPostOutputs(key storytellerModel.AuthorIdentityKey, author storytellerModel.AuthorIdentityOutput, posts []storytellerModel.AuthorPost, viewerID uint64) ([]storytellerModel.AuthorPostOutput, error) {
	ids := make([]uint64, 0, len(posts))
	for _, post := range posts {
		ids = append(ids, post.ID)
	}
	likes, err := s.repo.AuthorPostLikeCounts(ids)
	if err != nil {
		return nil, err
	}
	comments, err := s.repo.CommentCounts(storytellerModel.CommentTargetAuthorPost, ids)
	if err != nil {
		return nil, err
	}
	liked, err := s.repo.LikedAuthorPostIDs(viewerID, ids)
	if err != nil {
		return nil, err
	}
	attachments, err := s.postAttachmentOutputs(key, posts)
	if err != nil {
		return nil, err
	}
	outputs := make([]storytellerModel.AuthorPostOutput, 0, len(posts))
	for _, post := range posts {
		outputs = append(outputs, storytellerModel.AuthorPostOutput{
			PublicID: post.PublicID, Author: author, Body: post.Body, Pinned: post.PinnedAt != nil,
			Attachment: attachments[post.ID], LikeCount: likes[post.ID], CommentCount: comments[post.ID],
			LikedByMe: liked[post.ID], IsOwner: viewerID != 0 && viewerID == post.UserID, CreatedAt: post.CreatedAt,
		})
	}
	return outputs, nil
}

// postAttachmentOutputs 即時檢查作品卡是否仍可見：作品轉私密、刪除、那一話下架，或已不再署名
// 這個身份時都只回 Unavailable，不露出標題與封面。
func (s *Service) postAttachmentOutputs(key storytellerModel.AuthorIdentityKey, posts []storytellerModel.AuthorPost) (map[uint64]*storytellerModel.AuthorPostAttachmentOutput, error) {
	result := make(map[uint64]*storytellerModel.AuthorPostAttachmentOutput)
	projectIDs := make([]uint64, 0)
	for _, post := range posts {
		if post.AttachProjectID != 0 {
			projectIDs = append(projectIDs, post.AttachProjectID)
		}
	}
	if len(projectIDs) == 0 {
		return result, nil
	}
	projectIDs = uniqueUint64(projectIDs)
	refs, err := s.repo.IdentityVisibleStoryRefs(key.UserID, key.ProfileID, projectIDs)
	if err != nil {
		return nil, err
	}
	visibleProjects, visibleStories := map[uint64]bool{}, map[uint64]storytellerRepo.IdentityStoryRef{}
	for _, ref := range refs {
		visibleProjects[ref.ProjectID] = true
		visibleStories[ref.ID] = ref
	}
	projects, err := s.repo.ProjectsByIDs(projectIDs)
	if err != nil {
		return nil, err
	}
	covers := make([]*storytellerModel.ProjectOutput, 0, len(projects))
	byID := make(map[uint64]*storytellerModel.ProjectOutput, len(projects))
	for _, project := range projects {
		output := outputProject(project)
		covers = append(covers, output)
		byID[project.ID] = output
	}
	if err := s.attachProjectCovers(covers); err != nil {
		return nil, err
	}
	for _, post := range posts {
		if post.AttachProjectID == 0 {
			continue
		}
		project, story := byID[post.AttachProjectID], visibleStories[post.AttachStoryID]
		if project == nil || !visibleProjects[post.AttachProjectID] || (post.AttachStoryID != 0 && story.ID == 0) {
			result[post.ID] = &storytellerModel.AuthorPostAttachmentOutput{Unavailable: true}
			continue
		}
		result[post.ID] = &storytellerModel.AuthorPostAttachmentOutput{
			ProjectPublicID: project.PublicID, ProjectSlug: project.Slug, ProjectName: project.Name,
			Rating: project.Rating, CoverURL: project.CoverURL,
			StoryPublicID: story.PublicID, StoryTitle: story.Title, VolumeTitle: story.VolumeTitle,
		}
	}
	return result, nil
}
