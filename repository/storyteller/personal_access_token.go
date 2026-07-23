package storyteller

import (
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

func (r *Repository) CreatePersonalAccessToken(row *storytellerModel.PersonalAccessToken) error {
	return r.db.Create(row).Error
}

func (r *Repository) PersonalAccessTokens(userID uint64) ([]storytellerModel.PersonalAccessToken, error) {
	rows := make([]storytellerModel.PersonalAccessToken, 0)
	err := r.db.Where("user_id = ? AND is_deleted = 0", userID).
		Order("created_at DESC, id DESC").
		Find(&rows).Error
	return rows, err
}

func (r *Repository) PersonalAccessTokenByID(userID, id uint64) (*storytellerModel.PersonalAccessToken, error) {
	var row storytellerModel.PersonalAccessToken
	err := r.db.Where("id = ? AND user_id = ? AND is_deleted = 0", id, userID).First(&row).Error
	return &row, err
}

func (r *Repository) PersonalAccessTokenByHash(tokenHash string) (*storytellerModel.PersonalAccessToken, error) {
	var row storytellerModel.PersonalAccessToken
	err := r.db.Where("token_hash = ? AND is_deleted = 0", tokenHash).First(&row).Error
	return &row, err
}

func (r *Repository) DeletePersonalAccessToken(row *storytellerModel.PersonalAccessToken) error {
	now := time.Now()
	row.IsDeleted = true
	row.DeletedAt = &now
	return r.db.Save(row).Error
}

func (r *Repository) TouchPersonalAccessTokenLastUsed(id uint64) error {
	return r.db.Model(&storytellerModel.PersonalAccessToken{}).
		Where("id = ?", id).
		Update("last_used_at", time.Now()).Error
}
