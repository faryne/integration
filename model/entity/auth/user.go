package auth

import "time"

type User struct {
	Id          uint64     `json:"id" gorm:"primary_key"`
	FirebaseUID string     `json:"firebase_uid" gorm:"column:firebase_uid"`
	Email       *string    `json:"email"`
	DisplayName *string    `json:"display_name"`
	PhotoURL    *string    `json:"photo_url" gorm:"column:photo_url"`
	Disabled    bool       `json:"disabled"`
	IsAdmin     bool       `json:"is_admin" gorm:"column:is_admin"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
	LastLoginAt *time.Time `json:"last_login_at"`
}

func (User) TableName() string {
	return "users"
}
