package storyteller

import (
	"errors"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// 作者動態：貼文、置頂、按讚與作品卡。時間軸一律以 (user_id, profile_id) 查，
// 本人時間軸絕不能混進筆名的貼文。

func (r *Repository) CreateAuthorPost(row *storytellerModel.AuthorPost) error {
	return r.db.Create(row).Error
}

// AuthorPostByPublicID 只回未刪除的貼文。
func (r *Repository) AuthorPostByPublicID(publicID string) (*storytellerModel.AuthorPost, error) {
	var row storytellerModel.AuthorPost
	err := r.db.Where("public_id = ? AND is_deleted = 0", publicID).First(&row).Error
	return &row, err
}

// AuthorPostsByPublicIDs 含已刪除的貼文，給通知輸出判斷「這則已刪除」用。
func (r *Repository) AuthorPostsByPublicIDs(publicIDs []string) ([]storytellerModel.AuthorPost, error) {
	rows := make([]storytellerModel.AuthorPost, 0, len(publicIDs))
	if len(publicIDs) == 0 {
		return rows, nil
	}
	err := r.db.Where("public_id IN ?", publicIDs).Find(&rows).Error
	return rows, err
}

func (r *Repository) activeIdentityPosts(userID, profileID uint64) *gorm.DB {
	return r.db.Model(&storytellerModel.AuthorPost{}).Where("user_id = ? AND profile_id = ? AND is_deleted = 0", userID, profileID)
}

// PinnedAuthorPost 回傳該身份的置頂貼文；沒有時回 nil。
func (r *Repository) PinnedAuthorPost(userID, profileID uint64) (*storytellerModel.AuthorPost, error) {
	rows := make([]storytellerModel.AuthorPost, 0, 1)
	if err := r.activeIdentityPosts(userID, profileID).Where("pinned_at IS NOT NULL").Limit(1).Find(&rows).Error; err != nil || len(rows) == 0 {
		return nil, err
	}
	return &rows[0], nil
}

// AuthorPostsByIdentity 是時間軸（不含置頂那則，置頂另外查）：依 id 新到舊，cursor 是上一頁最後一則的 public_id。
func (r *Repository) AuthorPostsByIdentity(userID, profileID uint64, cursorPublicID string, limit int) ([]storytellerModel.AuthorPost, error) {
	q := r.activeIdentityPosts(userID, profileID).Where("pinned_at IS NULL")
	if cursorPublicID != "" {
		q = q.Where("id < (SELECT id FROM storyteller_author_posts WHERE public_id = ?)", cursorPublicID)
	}
	rows := make([]storytellerModel.AuthorPost, 0, limit)
	err := q.Order("id DESC").Limit(limit).Find(&rows).Error
	return rows, err
}

func (r *Repository) SoftDeleteAuthorPost(id uint64) error {
	return r.db.Model(&storytellerModel.AuthorPost{}).Where("id = ?", id).
		Updates(map[string]any{"is_deleted": true, "deleted_at": time.Now(), "pinned_at": nil}).Error
}

// SetAuthorPostPinned 置頂時同交易先清掉同身份其他置頂，確保每個身份最多一則。
func (r *Repository) SetAuthorPostPinned(post *storytellerModel.AuthorPost, pinned bool) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if pinned {
			if err := tx.Model(&storytellerModel.AuthorPost{}).
				Where("user_id = ? AND profile_id = ? AND pinned_at IS NOT NULL", post.UserID, post.ProfileID).
				UpdateColumn("pinned_at", nil).Error; err != nil {
				return err
			}
			return tx.Model(post).UpdateColumn("pinned_at", gorm.Expr("NOW()")).Error
		}
		return tx.Model(post).UpdateColumn("pinned_at", nil).Error
	})
}

// ---- 按讚／計數 ----

func (r *Repository) LikeAuthorPost(postID, userID uint64) error {
	return r.db.Clauses(clause.Insert{Modifier: "IGNORE"}).Create(&storytellerModel.AuthorPostLike{PostID: postID, UserID: userID}).Error
}

func (r *Repository) UnlikeAuthorPost(postID, userID uint64) error {
	return r.db.Where("post_id = ? AND user_id = ?", postID, userID).Delete(&storytellerModel.AuthorPostLike{}).Error
}

// countByPost 是「一頁貼文一支 GROUP BY」的共用寫法，不做反正規化計數欄位。
func countByPost(q *gorm.DB, column string, postIDs []uint64) (map[uint64]int64, error) {
	result := make(map[uint64]int64, len(postIDs))
	if len(postIDs) == 0 {
		return result, nil
	}
	type row struct {
		PostID uint64
		Total  int64
	}
	rows := make([]row, 0, len(postIDs))
	if err := q.Select(column+" AS post_id, COUNT(*) AS total").Where(column+" IN ?", postIDs).Group(column).Scan(&rows).Error; err != nil {
		return nil, err
	}
	for _, item := range rows {
		result[item.PostID] = item.Total
	}
	return result, nil
}

func (r *Repository) AuthorPostLikeCounts(postIDs []uint64) (map[uint64]int64, error) {
	return countByPost(r.db.Model(&storytellerModel.AuthorPostLike{}), "post_id", postIDs)
}

// CommentCounts 是留言數＝頂層＋回覆，排除已刪除；動態與討論串共用。
func (r *Repository) CommentCounts(targetType storytellerModel.CommentTargetType, targetIDs []uint64) (map[uint64]int64, error) {
	return countByPost(r.db.Model(&storytellerModel.Comment{}).
		Where("target_type = ? AND is_deleted = 0", targetType), "target_id", targetIDs)
}

func (r *Repository) LikedAuthorPostIDs(userID uint64, postIDs []uint64) (map[uint64]bool, error) {
	result := make(map[uint64]bool, len(postIDs))
	if userID == 0 || len(postIDs) == 0 {
		return result, nil
	}
	ids := make([]uint64, 0, len(postIDs))
	if err := r.db.Model(&storytellerModel.AuthorPostLike{}).Where("user_id = ? AND post_id IN ?", userID, postIDs).Pluck("post_id", &ids).Error; err != nil {
		return nil, err
	}
	for _, id := range ids {
		result[id] = true
	}
	return result, nil
}

// ---- 作品卡 ----

// IdentityStoryRef 是「對讀者可見、且署名該身份」的一話，作品卡驗證、輸出與候選清單共用。
type IdentityStoryRef struct {
	ID          uint64
	PublicID    string
	ProjectID   uint64
	Title       string
	VolumeTitle string
}

// IdentityVisibleStoryRefs 沿用作者頁的可見性規則（identityVisibleStoriesJoin）；projectIDs 為空時不限專案。
func (r *Repository) IdentityVisibleStoryRefs(userID, profileID uint64, projectIDs []uint64) ([]IdentityStoryRef, error) {
	q := r.identityVisibleStoriesJoin(userID, profileID)
	if len(projectIDs) > 0 {
		q = q.Where("projects.id IN ?", projectIDs)
	}
	rows := make([]IdentityStoryRef, 0)
	err := q.Select("stories.id, stories.public_id, stories.project_id, stories.title, COALESCE(parent.title, '') AS volume_title").
		Order("stories.project_id ASC, stories.sort DESC, stories.id DESC").
		Scan(&rows).Error
	return rows, err
}

// ProjectsByIDs 只回未刪除的專案；作品卡輸出時拿名稱、slug、封面用（可見性另由 IdentityVisibleStoryRefs 判斷）。
func (r *Repository) ProjectsByIDs(ids []uint64) ([]storytellerModel.Project, error) {
	rows := make([]storytellerModel.Project, 0, len(ids))
	if len(ids) == 0 {
		return rows, nil
	}
	err := r.db.Where("id IN ? AND deleted_at IS NULL", ids).Find(&rows).Error
	return rows, err
}

// ---- 追蹤者通知掃描 ----

// AuthorPostsToNotify 撈還沒通知過的貼文，依身份排序方便切批。
func (r *Repository) AuthorPostsToNotify(limit int) ([]storytellerModel.AuthorPost, error) {
	rows := make([]storytellerModel.AuthorPost, 0)
	err := r.db.Where("notified_at IS NULL AND is_deleted = 0").
		Order("user_id ASC, profile_id ASC, id ASC").Limit(limit).Find(&rows).Error
	return rows, err
}

// IdentityFollowers 回傳追蹤這個身份的帳號（以哪個身份追蹤都算，依帳號去重）。
func (r *Repository) IdentityFollowers(userID, profileID uint64) ([]uint64, error) {
	ids := make([]uint64, 0)
	err := r.db.Model(&storytellerModel.AuthorFavorite{}).
		Where("author_user_id = ? AND author_profile_id = ? AND deleted_at IS NULL", userID, profileID).
		Distinct().Pluck("user_id", &ids).Error
	return ids, err
}

// ClaimAuthorPosts 同交易寫入 notified_at 與通知；任何一則已被別的執行處理過就整批 rollback，交給下一輪。
func (r *Repository) ClaimAuthorPosts(postIDs []uint64, rows []*storytellerModel.Notification) (bool, error) {
	err := r.db.Transaction(func(tx *gorm.DB) error {
		result := tx.Model(&storytellerModel.AuthorPost{}).
			Where("id IN ? AND notified_at IS NULL", postIDs).
			UpdateColumn("notified_at", gorm.Expr("NOW()"))
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != int64(len(postIDs)) {
			return errNotificationClaimConflict
		}
		if len(rows) == 0 {
			return nil
		}
		return tx.Clauses(clause.Insert{Modifier: "IGNORE"}).CreateInBatches(rows, notificationInsertBatch).Error
	})
	if errors.Is(err, errNotificationClaimConflict) {
		return false, nil
	}
	return err == nil, err
}

// AuthorPostByID 只回未刪除的貼文；留言刪除／封鎖時從留言反查貼文用。
func (r *Repository) AuthorPostByID(id uint64) (*storytellerModel.AuthorPost, error) {
	var row storytellerModel.AuthorPost
	err := r.db.Where("id = ? AND is_deleted = 0", id).First(&row).Error
	return &row, err
}
