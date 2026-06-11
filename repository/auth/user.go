package auth

import (
	"time"

	modelAuth "faryne.dev/model/entity/auth"
	"faryne.dev/model/enum"
	"faryne.dev/repository"
	"faryne.dev/service/client"
	"gorm.io/gorm/clause"
)

type UserRepository struct {
	*repository.Repository[modelAuth.User]
}

func NewUserRepository() *UserRepository {
	return &UserRepository{
		Repository: repository.NewRepository[modelAuth.User](client.GetDB(enum.DBWalolita)),
	}
}

func (r *UserRepository) UpsertFirebaseUser(input modelAuth.User) (*modelAuth.User, error) {
	now := time.Now()
	input.LastLoginAt = &now

	if err := r.GetDB().Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "firebase_uid"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"email",
			"display_name",
			"photo_url",
			"last_login_at",
		}),
	}).Create(&input).Error; err != nil {
		return nil, err
	}

	var user modelAuth.User
	if err := r.GetDB().Where("firebase_uid = ?", input.FirebaseUID).First(&user).Error; err != nil {
		return nil, err
	}
	return &user, nil
}
