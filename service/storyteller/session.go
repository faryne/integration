package storyteller

import (
	modelAuth "faryne.dev/model/entity/auth"
	storytellerModel "faryne.dev/model/entity/storyteller"
	storytellerRepo "faryne.dev/repository/storyteller"
	authService "faryne.dev/service/auth"
)

// UpsertFirebaseUser 是 storyteller 登入專用的 auth.User 轉接層；身份來源只寫 storyteller_users。
func UpsertFirebaseUser(token *authService.FirebaseToken) (*modelAuth.User, error) {
	profile, err := storytellerRepo.NewRepository().UpsertFirebaseUser(storytellerModel.UserProfile{
		UserID:                  0,
		FirebaseUID:             token.UID,
		Email:                   token.Email,
		DisplayName:             token.DisplayName,
		PhotoURL:                token.PhotoURL,
		UseDefaultAvatar:        true,
		AutoSaveEnabled:         true,
		AutoSaveIntervalMinutes: autoSaveIntervalMinutesDefault,
	})
	if err != nil {
		return nil, err
	}
	return &modelAuth.User{
		Id:          profile.ID,
		FirebaseUID: profile.FirebaseUID,
		Email:       profile.Email,
		DisplayName: profile.DisplayName,
		PhotoURL:    profile.PhotoURL,
	}, nil
}
