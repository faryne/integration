package storyteller

import (
	"errors"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// notificationInsertBatch 是 fan-out 時每批 INSERT 的筆數，熱門作者粉絲多時避免單一語句過大。
const notificationInsertBatch = 500

// errNotificationClaimConflict 只在交易內部用來觸發 rollback，不會往外拋。
var errNotificationClaimConflict = errors.New("notification publish claim conflict")

// activeNotifications 是收件人自己看得到的通知（未被刪除）。
func (r *Repository) activeNotifications(userID uint64) *gorm.DB {
	return r.db.Model(&storytellerModel.Notification{}).Where("user_id = ? AND is_deleted = 0", userID)
}

// InsertNotifications 以 (user_id, group_key) 唯一鍵 INSERT IGNORE，重送或排程重跑都不會重複發。
func (r *Repository) InsertNotifications(rows []*storytellerModel.Notification) error {
	if len(rows) == 0 {
		return nil
	}
	return r.db.Clauses(clause.Insert{Modifier: "IGNORE"}).CreateInBatches(rows, notificationInsertBatch).Error
}

// NotificationPublishCandidates 撈「現在對讀者可見、但 first_published_at 還是 NULL」的話，
// 可見條件與 PublishedStories 相同：專案公開、話已完成、沒分冊或所屬冊已完成。
func (r *Repository) NotificationPublishCandidates(limit int) ([]storytellerModel.NotificationPublishCandidate, error) {
	rows := make([]storytellerModel.NotificationPublishCandidate, 0)
	err := r.db.
		Table("storyteller_stories AS stories").
		Joins("INNER JOIN storyteller_projects AS projects ON projects.id = stories.project_id").
		Joins("LEFT JOIN storyteller_stories AS parent ON parent.id = stories.parent_id").
		Where("stories.first_published_at IS NULL AND stories.is_volume = 0 AND stories.is_deleted = 0 AND stories.deleted_at IS NULL AND stories.status = ?", storytellerModel.StoryStatusCompleted).
		Where("projects.visibility = ? AND projects.deleted_at IS NULL", storytellerModel.ProjectVisibilityPublic).
		Where("stories.parent_id IS NULL OR parent.status = ?", storytellerModel.StoryStatusCompleted).
		Select("stories.id, stories.public_id, stories.project_id, stories.title, stories.word_count, COALESCE(parent.title, '') AS volume_title, projects.public_id AS project_public_id, projects.user_id AS project_user_id").
		Order("stories.project_id ASC, stories.sort ASC, stories.id ASC").
		Limit(limit).
		Scan(&rows).Error
	return rows, err
}

// ProjectHasPublishedStory 判斷專案先前是否已經有話公開過；沒有的話這一批就是「新作品公開」。
// 刪除過的話也算，避免作者刪光重發時被當成新作品。
func (r *Repository) ProjectHasPublishedStory(projectID uint64) (bool, error) {
	var count int64
	err := r.db.Model(&storytellerModel.Story{}).
		Where("project_id = ? AND first_published_at IS NOT NULL", projectID).
		Limit(1).Count(&count).Error
	return count > 0, err
}

// NotificationRecipients 回傳要收到這批更新的讀者：追蹤任一署名身份的人，加上收藏這部作品的人。
func (r *Repository) NotificationRecipients(projectID, authorUserID uint64, profileIDs []uint64) ([]uint64, error) {
	ids := make([]uint64, 0)
	if len(profileIDs) > 0 {
		if err := r.db.Model(&storytellerModel.AuthorFavorite{}).
			Where("author_user_id = ? AND author_profile_id IN ? AND deleted_at IS NULL", authorUserID, profileIDs).
			Distinct().Pluck("user_id", &ids).Error; err != nil {
			return nil, err
		}
	}
	favorites := make([]uint64, 0)
	if err := r.db.Model(&storytellerModel.ProjectRanking{}).
		Where("project_id = ? AND is_favorite = 1 AND deleted_at IS NULL", projectID).
		Distinct().Pluck("user_id", &favorites).Error; err != nil {
		return nil, err
	}
	return append(ids, favorites...), nil
}

// ClaimPublishedStories 在同一個交易裡寫入 first_published_at 與通知。只要有任何一話已被
// 別的執行先寫掉（affected 不足），整批 rollback 回傳 false，交給下一輪重算，避免重複派送。
func (r *Repository) ClaimPublishedStories(storyIDs []uint64, rows []*storytellerModel.Notification) (bool, error) {
	claimed := false
	err := r.db.Transaction(func(tx *gorm.DB) error {
		result := tx.Model(&storytellerModel.Story{}).
			Where("id IN ? AND first_published_at IS NULL", storyIDs).
			UpdateColumn("first_published_at", time.Now())
		if result.Error != nil {
			return result.Error
		}
		if result.RowsAffected != int64(len(storyIDs)) {
			return errNotificationClaimConflict
		}
		if len(rows) > 0 {
			if err := tx.Clauses(clause.Insert{Modifier: "IGNORE"}).CreateInBatches(rows, notificationInsertBatch).Error; err != nil {
				return err
			}
		}
		claimed = true
		return nil
	})
	if errors.Is(err, errNotificationClaimConflict) {
		return false, nil
	}
	return claimed, err
}

func (r *Repository) Notifications(userID uint64, filter storytellerModel.NotificationFilter, cursorPublicID string, limit int) ([]storytellerModel.Notification, error) {
	q := r.activeNotifications(userID)
	switch filter {
	case storytellerModel.NotificationFilterUnread:
		q = q.Where("read_at IS NULL")
	case storytellerModel.NotificationFilterLocked:
		q = q.Where("locked_at IS NOT NULL")
	}
	if cursorPublicID != "" {
		q = q.Where("id < (SELECT id FROM storyteller_notifications WHERE user_id = ? AND public_id = ?)", userID, cursorPublicID)
	}
	rows := make([]storytellerModel.Notification, 0, limit)
	err := q.Order("id DESC").Limit(limit).Find(&rows).Error
	return rows, err
}

func (r *Repository) Notification(userID uint64, publicID string) (*storytellerModel.Notification, error) {
	var row storytellerModel.Notification
	if err := r.activeNotifications(userID).Where("public_id = ?", publicID).Take(&row).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

func (r *Repository) NotificationCounts(userID uint64) (unread, locked int64, err error) {
	var counts struct {
		Unread int64
		Locked int64
	}
	err = r.activeNotifications(userID).
		Select("COALESCE(SUM(read_at IS NULL), 0) AS unread, COALESCE(SUM(locked_at IS NOT NULL), 0) AS locked").
		Scan(&counts).Error
	return counts.Unread, counts.Locked, err
}

func (r *Repository) UnreadNotificationCount(userID uint64) (int64, error) {
	var count int64
	err := r.activeNotifications(userID).Where("read_at IS NULL").Count(&count).Error
	return count, err
}

func (r *Repository) MarkNotificationRead(userID uint64, publicID string) error {
	return r.activeNotifications(userID).
		Where("public_id = ? AND read_at IS NULL", publicID).
		UpdateColumn("read_at", time.Now()).Error
}

func (r *Repository) MarkAllNotificationsRead(userID uint64) (int64, error) {
	result := r.activeNotifications(userID).Where("read_at IS NULL").UpdateColumn("read_at", time.Now())
	return result.RowsAffected, result.Error
}

// LockNotification 以條件式 UPDATE 檢查上限，不先查再寫；affected=0 代表已達上限。
func (r *Repository) LockNotification(id, userID uint64, limit int) (bool, error) {
	result := r.db.Exec(`UPDATE storyteller_notifications AS n
		INNER JOIN (
			SELECT COUNT(*) AS locked FROM storyteller_notifications
			WHERE user_id = ? AND is_deleted = 0 AND locked_at IS NOT NULL
		) AS t
		SET n.locked_at = ?
		WHERE n.id = ? AND n.locked_at IS NULL AND t.locked < ?`, userID, time.Now(), id, limit)
	return result.RowsAffected > 0, result.Error
}

func (r *Repository) UnlockNotification(id uint64) error {
	return r.db.Model(&storytellerModel.Notification{}).Where("id = ?", id).UpdateColumn("locked_at", nil).Error
}

// SoftDeleteNotification 同時清掉 locked_at：使用者刪掉的通知不該再佔鎖定名額，也要能被保留期清除。
func (r *Repository) SoftDeleteNotification(id uint64) error {
	now := time.Now()
	return r.db.Model(&storytellerModel.Notification{}).Where("id = ?", id).
		UpdateColumns(map[string]any{"is_deleted": true, "deleted_at": &now, "locked_at": nil}).Error
}

// PurgeExpiredNotifications 分批 hard delete 建立超過保留期且未鎖定的通知（含已軟刪除的），
// 每批限制筆數避免長時間鎖表。
func (r *Repository) PurgeExpiredNotifications(before time.Time, batch int) (int64, error) {
	var total int64
	for {
		result := r.db.Exec("DELETE FROM storyteller_notifications WHERE locked_at IS NULL AND created_at < ? LIMIT ?", before, batch)
		if result.Error != nil {
			return total, result.Error
		}
		total += result.RowsAffected
		if result.RowsAffected < int64(batch) {
			return total, nil
		}
	}
}
