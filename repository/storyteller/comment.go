package storyteller

import (
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

// 通用留言：v1 只掛在作者動態，之後的討論區沿用。

func (r *Repository) CreateComment(row *storytellerModel.Comment) error {
	return r.db.Create(row).Error
}

// CommentByPublicID 只回未刪除的留言：已刪除的不能再被回覆、刪除或封鎖。
func (r *Repository) CommentByPublicID(publicID string) (*storytellerModel.Comment, error) {
	var row storytellerModel.Comment
	err := r.db.Where("public_id = ? AND is_deleted = 0", publicID).First(&row).Error
	return &row, err
}

// CommentsByPublicIDs 含已刪除，給通知輸出判斷「這則留言已刪除」用。
func (r *Repository) CommentsByPublicIDs(publicIDs []string) ([]storytellerModel.Comment, error) {
	rows := make([]storytellerModel.Comment, 0, len(publicIDs))
	if len(publicIDs) == 0 {
		return rows, nil
	}
	err := r.db.Where("public_id IN ?", publicIDs).Find(&rows).Error
	return rows, err
}

// CommentsByTarget 回傳整串留言（含已刪除，前端要留佔位），依建立順序。
func (r *Repository) CommentsByTarget(targetType storytellerModel.CommentTargetType, targetID uint64) ([]storytellerModel.Comment, error) {
	rows := make([]storytellerModel.Comment, 0)
	err := r.db.Where("target_type = ? AND target_id = ?", targetType, targetID).Order("id ASC").Find(&rows).Error
	return rows, err
}

func (r *Repository) SoftDeleteComment(id uint64) error {
	return r.db.Model(&storytellerModel.Comment{}).Where("id = ?", id).
		Updates(map[string]any{"is_deleted": true, "deleted_at": time.Now()}).Error
}
