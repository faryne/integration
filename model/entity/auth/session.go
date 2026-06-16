package auth

type SessionResponse struct {
	User       UserResponse `json:"user"`
	EncryptKey string       `json:"encrypt_key"`
	ExpiresAt  string       `json:"expires_at"`
}

type UserResponse struct {
	Id          uint64  `json:"id"`
	FirebaseUID string  `json:"firebase_uid"`
	Email       *string `json:"email"`
	DisplayName *string `json:"display_name"`
	PhotoURL    *string `json:"photo_url"`
	IsAdmin     bool    `json:"is_admin"`
}

type RedisSession struct {
	UserId      uint64 `json:"user_id"`
	FirebaseUID string `json:"firebase_uid"`
	CreatedAt   string `json:"created_at"`
	ExpiresAt   string `json:"expires_at"`
}
