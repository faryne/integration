package storyteller

import (
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"gorm.io/gorm"
)

func (r *Repository) AuthorProfilesByUserID(userID uint64) ([]storytellerModel.AuthorProfile, error) {
	rows := make([]storytellerModel.AuthorProfile, 0)
	err := r.db.Where("user_id = ? AND deleted_at IS NULL", userID).
		Order("id ASC").
		Find(&rows).Error
	return rows, err
}

func (r *Repository) AuthorProfileCount(userID uint64) (int64, error) {
	var count int64
	err := r.db.Model(&storytellerModel.AuthorProfile{}).
		Where("user_id = ? AND deleted_at IS NULL", userID).
		Count(&count).Error
	return count, err
}

func (r *Repository) AuthorProfileByIDForUser(userID, id uint64) (*storytellerModel.AuthorProfile, error) {
	var row storytellerModel.AuthorProfile
	err := r.db.Where("id = ? AND user_id = ? AND deleted_at IS NULL", id, userID).First(&row).Error
	return &row, err
}

func (r *Repository) AuthorProfileByPenName(penName string) (*storytellerModel.AuthorProfile, error) {
	var row storytellerModel.AuthorProfile
	err := r.db.Where("pen_name = ? AND deleted_at IS NULL", penName).First(&row).Error
	return &row, err
}

// AuthorProfileByPenNameWithDeleted 含軟刪列：DB 的 pen_name unique 不看 deleted_at，
// 已刪筆名的名字仍被保留（同 storyteller_users 的既有行為），檢查撞名時要一併算進去。
func (r *Repository) AuthorProfileByPenNameWithDeleted(penName string) (*storytellerModel.AuthorProfile, error) {
	var row storytellerModel.AuthorProfile
	err := r.db.Unscoped().Where("pen_name = ?", penName).First(&row).Error
	return &row, err
}

func (r *Repository) AuthorProfilesByIDs(ids []uint64) (map[uint64]storytellerModel.AuthorProfile, error) {
	result := make(map[uint64]storytellerModel.AuthorProfile, len(ids))
	if len(ids) == 0 {
		return result, nil
	}
	rows := make([]storytellerModel.AuthorProfile, 0)
	if err := r.db.Where("id IN ? AND deleted_at IS NULL", ids).Find(&rows).Error; err != nil {
		return nil, err
	}
	for _, row := range rows {
		result[row.ID] = row
	}
	return result, nil
}

func (r *Repository) UserProfilesByIDs(ids []uint64) (map[uint64]storytellerModel.UserProfile, error) {
	result := make(map[uint64]storytellerModel.UserProfile, len(ids))
	if len(ids) == 0 {
		return result, nil
	}
	rows := make([]storytellerModel.UserProfile, 0)
	if err := r.db.Where("id IN ? AND deleted_at IS NULL", ids).Find(&rows).Error; err != nil {
		return nil, err
	}
	for _, row := range rows {
		result[row.ID] = row
	}
	return result, nil
}

func (r *Repository) CreateAuthorProfile(row *storytellerModel.AuthorProfile) error {
	if row.PublicID == "" {
		row.PublicID = newPublicID()
	}
	return r.db.Create(row).Error
}

func (r *Repository) SaveAuthorProfile(row *storytellerModel.AuthorProfile) error {
	return r.db.Save(row).Error
}

// DeleteAuthorProfile 刪筆名時一併取消以這個筆名做的追蹤，免得留下對方看得到、卻已不存在的追蹤者；
// 這個筆名的動態、以它身份發的留言與討論串、它的封鎖名單也一起 soft delete。
// reason 是站方處置理由（本人刪除傳 nil）：筆名本身與連帶的動態、留言、討論串都寫入同一個理由。
func (r *Repository) DeleteAuthorProfile(row *storytellerModel.AuthorProfile, reason *string) error {
	now := time.Now()
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(row).Updates(map[string]any{"is_deleted": true, "deleted_at": &now, "delete_reason": reason}).Error; err != nil {
			return err
		}
		if err := tx.Model(&storytellerModel.AuthorFavorite{}).
			Where("user_id = ? AND follower_profile_id = ? AND deleted_at IS NULL", row.UserID, row.ID).
			Update("deleted_at", &now).Error; err != nil {
			return err
		}
		// 封鎖名單沒有 delete_reason 欄位，另外處理
		softDelete := map[string]any{"is_deleted": true, "deleted_at": &now}
		withReason := map[string]any{"is_deleted": true, "deleted_at": &now, "delete_reason": reason}
		for _, item := range []struct {
			model  any
			values map[string]any
		}{{&storytellerModel.AuthorPost{}, withReason}, {&storytellerModel.Comment{}, withReason}, {&storytellerModel.DiscussionThread{}, withReason}, {&storytellerModel.AuthorBlock{}, softDelete}} {
			if err := tx.Model(item.model).Where("user_id = ? AND profile_id = ? AND is_deleted = 0", row.UserID, row.ID).Updates(item.values).Error; err != nil {
				return err
			}
		}
		return nil
	})
}

// AuthorPostCountByIdentity 給刪筆名前的確認視窗：「這個筆名的 N 則動態也會一起刪除」。
func (r *Repository) AuthorPostCountByIdentity(userID, profileID uint64) (int64, error) {
	var count int64
	err := r.activeIdentityPosts(userID, profileID).Count(&count).Error
	return count, err
}

func (r *Repository) StoryProfilesByStoryIDs(storyIDs []uint64) (map[uint64][]uint64, error) {
	result := make(map[uint64][]uint64, len(storyIDs))
	if len(storyIDs) == 0 {
		return result, nil
	}
	rows := make([]storytellerModel.StoryProfile, 0)
	if err := r.db.Where("story_id IN ?", storyIDs).Order("id ASC").Find(&rows).Error; err != nil {
		return nil, err
	}
	for _, row := range rows {
		result[row.StoryID] = append(result[row.StoryID], row.ProfileID)
	}
	return result, nil
}

func (r *Repository) ReplaceStoryProfiles(storyID uint64, profileIDs []uint64) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("story_id = ?", storyID).Delete(&storytellerModel.StoryProfile{}).Error; err != nil {
			return err
		}
		if len(profileIDs) == 0 {
			return nil
		}
		rows := make([]storytellerModel.StoryProfile, 0, len(profileIDs))
		for _, id := range profileIDs {
			rows = append(rows, storytellerModel.StoryProfile{StoryID: storyID, ProfileID: id})
		}
		return tx.Create(&rows).Error
	})
}

// LiveStoryCountByProfileID 是還在使用這個筆名的話數：只算話未刪除、所屬作品也未刪除的署名。
// 刪掉的話與作品不再佔用筆名（軟刪除不會清 pivot，所以要在這裡排除），刪筆名前用它判斷。
func (r *Repository) LiveStoryCountByProfileID(profileID uint64) (int64, error) {
	var count int64
	err := r.db.Table("storyteller_story_profiles AS sp").
		Joins("INNER JOIN storyteller_stories AS stories ON stories.id = sp.story_id").
		Joins("INNER JOIN storyteller_projects AS projects ON projects.id = stories.project_id").
		Where("sp.profile_id = ? AND stories.is_deleted = 0 AND stories.deleted_at IS NULL AND projects.deleted_at IS NULL", profileID).
		Count(&count).Error
	return count, err
}

// identityVisibleStoriesJoin 把「對讀者可見、且署名該身份」的 story 接到 projects 上。
// profileID=0 含「有 profile_id=0 列」或「完全沒有 pivot 列」。
func (r *Repository) identityVisibleStoriesJoin(userID, profileID uint64) *gorm.DB {
	q := r.db.
		Table("storyteller_projects AS projects").
		Joins("INNER JOIN storyteller_stories AS stories ON stories.project_id = projects.id AND stories.is_volume = 0 AND stories.is_deleted = 0 AND stories.deleted_at IS NULL AND stories.status = ?", storytellerModel.StoryStatusCompleted).
		Joins("LEFT JOIN storyteller_stories AS parent ON parent.id = stories.parent_id").
		Where("projects.user_id = ? AND projects.visibility = ? AND projects.deleted_at IS NULL", userID, storytellerModel.ProjectVisibilityPublic).
		Where("stories.parent_id IS NULL OR parent.status = ?", storytellerModel.StoryStatusCompleted)
	if profileID == 0 {
		return q.Where(`(
			EXISTS (SELECT 1 FROM storyteller_story_profiles sp WHERE sp.story_id = stories.id AND sp.profile_id = 0)
			OR NOT EXISTS (SELECT 1 FROM storyteller_story_profiles sp WHERE sp.story_id = stories.id)
		)`)
	}
	return q.Where(`EXISTS (SELECT 1 FROM storyteller_story_profiles sp WHERE sp.story_id = stories.id AND sp.profile_id = ?)`, profileID)
}

func (r *Repository) PublicProjectsByIdentity(userID, profileID uint64, offset, limit int) ([]storytellerModel.Project, int64, error) {
	var total int64
	countQuery := r.identityVisibleStoriesJoin(userID, profileID).Select("COUNT(DISTINCT projects.id)")
	if err := countQuery.Scan(&total).Error; err != nil {
		return nil, 0, err
	}
	rows := make([]storytellerModel.Project, 0)
	err := r.identityVisibleStoriesJoin(userID, profileID).
		Select("projects.*").
		Group("projects.id").
		Order("projects.updated_at DESC, projects.id DESC").
		Offset(offset).Limit(limit).
		Find(&rows).Error
	return rows, total, err
}

func (r *Repository) PublicStoriesByIdentity(userID, profileID uint64) ([]storytellerModel.Story, error) {
	rows := make([]storytellerModel.Story, 0)
	err := r.identityVisibleStoriesJoin(userID, profileID).
		Select("stories.*").
		Order("stories.id ASC").
		Find(&rows).Error
	return rows, err
}

func (r *Repository) PublicAuthorSummaryByIdentity(userID, profileID uint64) (uint64, uint64, uint64, uint64, uint64, float64, error) {
	type countResult struct {
		ProjectCount    uint64
		StoryCount      uint64
		ImageStoryCount uint64
	}
	var counts countResult
	if err := r.identityVisibleStoriesJoin(userID, profileID).
		Select(
			"COUNT(DISTINCT projects.id) AS project_count, COUNT(DISTINCT CASE WHEN stories.content_type != ? THEN stories.id END) AS story_count, COUNT(DISTINCT CASE WHEN stories.content_type = ? THEN stories.id END) AS image_story_count",
			storytellerModel.ProjectContentTypeImage,
			storytellerModel.ProjectContentTypeImage,
		).
		Scan(&counts).Error; err != nil {
		return 0, 0, 0, 0, 0, 0, err
	}
	type rankingResult struct {
		RatingCount   uint64
		AverageRating float64
	}
	var rankings rankingResult
	projectIDs := r.identityVisibleStoriesJoin(userID, profileID).Select("DISTINCT projects.id")
	if err := r.db.
		Table("storyteller_project_rankings AS rankings").
		Select("COUNT(rankings.ranking) AS rating_count, COALESCE(AVG(rankings.ranking), 0) AS average_rating").
		Where("rankings.project_id IN (?) AND rankings.ranking IS NOT NULL AND rankings.deleted_at IS NULL", projectIDs).
		Scan(&rankings).Error; err != nil {
		return 0, 0, 0, 0, 0, 0, err
	}
	followerCount, err := r.AuthorFollowerCount(userID, profileID)
	if err != nil {
		return 0, 0, 0, 0, 0, 0, err
	}
	return counts.ProjectCount, counts.StoryCount, counts.ImageStoryCount, rankings.RatingCount, followerCount, rankings.AverageRating, nil
}

func (r *Repository) AuthorFollowerCounts(keys []storytellerModel.AuthorIdentityKey) (map[storytellerModel.AuthorIdentityKey]uint64, error) {
	counts := make(map[storytellerModel.AuthorIdentityKey]uint64, len(keys))
	if len(keys) == 0 {
		return counts, nil
	}
	userIDs := make([]uint64, 0, len(keys))
	profileIDs := make([]uint64, 0, len(keys))
	seenUser := map[uint64]struct{}{}
	seenProfile := map[uint64]struct{}{}
	for _, key := range keys {
		if _, ok := seenUser[key.UserID]; !ok {
			seenUser[key.UserID] = struct{}{}
			userIDs = append(userIDs, key.UserID)
		}
		if _, ok := seenProfile[key.ProfileID]; !ok {
			seenProfile[key.ProfileID] = struct{}{}
			profileIDs = append(profileIDs, key.ProfileID)
		}
	}
	type result struct {
		AuthorUserID    uint64
		AuthorProfileID uint64
		Count           uint64
	}
	rows := make([]result, 0)
	if err := r.db.
		Table("storyteller_author_favorites").
		Select("author_user_id, author_profile_id, COUNT(*) AS count").
		Where("author_user_id IN ? AND author_profile_id IN ? AND deleted_at IS NULL", userIDs, profileIDs).
		Group("author_user_id, author_profile_id").
		Scan(&rows).Error; err != nil {
		return nil, err
	}
	wanted := make(map[storytellerModel.AuthorIdentityKey]struct{}, len(keys))
	for _, key := range keys {
		wanted[key] = struct{}{}
	}
	for _, row := range rows {
		key := storytellerModel.AuthorIdentityKey{UserID: row.AuthorUserID, ProfileID: row.AuthorProfileID}
		if _, ok := wanted[key]; ok {
			counts[key] = row.Count
		}
	}
	return counts, nil
}
