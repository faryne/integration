package storyteller

import (
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

// 停權帳號的排程清除：停權當下不動內容，停權滿一段時間後才把帳號下仍未刪除的內容以停權理由 soft delete。

// BannedUser 是停權超過期限、需要清除內容的帳號。
type BannedUser struct {
	ID           uint64
	DeleteReason string
}

// BannedUsersBefore 是在 cutoff 之前被站方停權的帳號。
func (r *Repository) BannedUsersBefore(cutoff time.Time) ([]BannedUser, error) {
	rows := make([]BannedUser, 0)
	err := r.db.Model(&storytellerModel.UserProfile{}).Select("id, delete_reason").
		Where("is_deleted = 1 AND delete_reason IS NOT NULL AND deleted_at < ?", cutoff).Scan(&rows).Error
	return rows, err
}

// LiveProjectsByUser 是帳號目前未刪除的作品（清除時要逐一處理搜尋索引與資產引用）。
func (r *Repository) LiveProjectsByUser(userID uint64) ([]storytellerModel.Project, error) {
	rows := make([]storytellerModel.Project, 0)
	err := r.db.Where("user_id = ? AND is_deleted = 0", userID).Find(&rows).Error
	return rows, err
}

// PurgeUserSocialContent 把帳號仍未刪除的動態、討論串、留言（所有身份）以同一個理由 soft delete，
// 回傳各自處理了幾筆。額外筆名由呼叫端先逐一走 DeleteAuthorProfile；只動未刪除的，作者先前自己刪的維持 delete_reason NULL。
func (r *Repository) PurgeUserSocialContent(userID uint64, reason string) (map[string]int64, error) {
	now := time.Now()
	counts := map[string]int64{}
	for name, model := range map[string]any{
		"posts": &storytellerModel.AuthorPost{}, "threads": &storytellerModel.DiscussionThread{}, "comments": &storytellerModel.Comment{},
	} {
		result := r.db.Model(model).Where("user_id = ? AND is_deleted = 0", userID).
			Updates(map[string]any{"is_deleted": true, "deleted_at": now, "delete_reason": reason})
		if result.Error != nil {
			return counts, result.Error
		}
		counts[name] = result.RowsAffected
	}
	return counts, nil
}
