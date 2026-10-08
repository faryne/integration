package storyteller

import (
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

// 作者封鎖名單：以「封鎖者身份」(user_id, profile_id) 為單位，被封鎖的是帳號。

// UpsertAuthorBlock 封鎖；之前解除過的同一組直接復活，public_id 沿用舊的。
func (r *Repository) UpsertAuthorBlock(row *storytellerModel.AuthorBlock) error {
	return r.db.Clauses(clause.OnConflict{
		Columns:   []clause.Column{{Name: "user_id"}, {Name: "profile_id"}, {Name: "blocked_user_id"}},
		DoUpdates: clause.Assignments(map[string]any{"is_deleted": false, "deleted_at": nil}),
	}).Create(row).Error
}

func (r *Repository) activeBlocks(userID, profileID uint64) *gorm.DB {
	return r.db.Model(&storytellerModel.AuthorBlock{}).Where("user_id = ? AND profile_id = ? AND is_deleted = 0", userID, profileID)
}

// BlockedUserIDs 回傳 candidates 裡被這個身份封鎖的帳號。
func (r *Repository) BlockedUserIDs(userID, profileID uint64, candidates []uint64) (map[uint64]bool, error) {
	result := make(map[uint64]bool, len(candidates))
	if len(candidates) == 0 {
		return result, nil
	}
	ids := make([]uint64, 0)
	if err := r.activeBlocks(userID, profileID).Where("blocked_user_id IN ?", candidates).Pluck("blocked_user_id", &ids).Error; err != nil {
		return nil, err
	}
	for _, id := range ids {
		result[id] = true
	}
	return result, nil
}

func (r *Repository) AuthorBlocks(userID, profileID uint64) ([]storytellerModel.AuthorBlock, error) {
	rows := make([]storytellerModel.AuthorBlock, 0)
	err := r.activeBlocks(userID, profileID).Order("id DESC").Find(&rows).Error
	return rows, err
}

// AuthorBlockByPublicIDForUser 只找本人（任一身份）建立、未解除的封鎖。
func (r *Repository) AuthorBlockByPublicIDForUser(userID uint64, publicID string) (*storytellerModel.AuthorBlock, error) {
	var row storytellerModel.AuthorBlock
	err := r.db.Where("public_id = ? AND user_id = ? AND is_deleted = 0", publicID, userID).First(&row).Error
	return &row, err
}

func (r *Repository) SoftDeleteAuthorBlock(id uint64) error {
	return r.db.Model(&storytellerModel.AuthorBlock{}).Where("id = ?", id).
		Updates(map[string]any{"is_deleted": true, "deleted_at": time.Now()}).Error
}
