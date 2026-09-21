package storyteller

import "time"

// AuthorProfile 是帳號底下的「額外筆名」。本人身份仍在 storyteller_users（UserProfile），
// 不搬遷；這張表只放另外建立的筆名。user_id 是擁有者帳號，僅後端使用、不對外輸出。
type AuthorProfile struct {
	ID               uint64     `gorm:"column:id;primaryKey" json:"id"`
	UserID           uint64     `gorm:"column:user_id" json:"-"`
	PenName          string     `gorm:"column:pen_name" json:"pen_name"`
	Bio              string     `gorm:"column:bio" json:"bio"`
	UseDefaultAvatar bool       `gorm:"column:use_default_avatar" json:"use_default_avatar"`
	AvatarURL        string     `gorm:"column:avatar_url" json:"avatar_url"`
	SNSLinks         SNSLinks   `gorm:"column:sns_links;type:json" json:"sns_links"`
	DeletedAt        *time.Time `gorm:"column:deleted_at" json:"deleted_at"`
	CreatedAt        time.Time  `gorm:"column:created_at" json:"created_at"`
	UpdatedAt        time.Time  `gorm:"column:updated_at" json:"updated_at"`
}

func (AuthorProfile) TableName() string {
	return "storyteller_author_profiles"
}

// StoryProfile 是 story 與署名身份的 pivot。ProfileID=0 代表帳號本人身份，
// 不對 author_profiles 加 FK；某 story 完全沒有列等同只有 [0]。
type StoryProfile struct {
	ID        uint64    `gorm:"column:id;primaryKey" json:"id"`
	StoryID   uint64    `gorm:"column:story_id" json:"story_id"`
	ProfileID uint64    `gorm:"column:profile_id" json:"profile_id"`
	CreatedAt time.Time `gorm:"column:created_at" json:"created_at"`
}

func (StoryProfile) TableName() string {
	return "storyteller_story_profiles"
}

// AuthorProfileRequest 是額外筆名的建立／更新請求。
type AuthorProfileRequest struct {
	PenName          string   `json:"pen_name"`
	Bio              string   `json:"bio"`
	UseDefaultAvatar bool     `json:"use_default_avatar"`
	AvatarURL        string   `json:"avatar_url"`
	SNSLinks         SNSLinks `json:"sns_links"`
}

// AuthorIdentityOutput 是公開身份輸出：不含帳號 id 或 profile id，身份只用 pen_name。
type AuthorIdentityOutput struct {
	PenName          string    `json:"pen_name"`
	Bio              string    `json:"bio,omitempty"`
	UseDefaultAvatar bool      `json:"use_default_avatar"`
	AvatarURL        string    `json:"avatar_url,omitempty"`
	SNSLinks         SNSLinks  `json:"sns_links,omitempty"`
	CreatedAt        time.Time `json:"created_at"`
}

// AuthorProfileOutput 是擁有者自己看的額外筆名，帶 id 供 CRUD 使用。
type AuthorProfileOutput struct {
	ID               uint64    `json:"id"`
	PenName          string    `json:"pen_name"`
	Bio              string    `json:"bio,omitempty"`
	UseDefaultAvatar bool      `json:"use_default_avatar"`
	AvatarURL        string    `json:"avatar_url,omitempty"`
	SNSLinks         SNSLinks  `json:"sns_links,omitempty"`
	CreatedAt        time.Time `json:"created_at"`
}

// AuthorIdentityKey 是後端內部用的身份鍵：ProfileID=0 代表本人。
type AuthorIdentityKey struct {
	UserID    uint64
	ProfileID uint64
}
