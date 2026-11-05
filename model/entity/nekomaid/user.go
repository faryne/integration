package nekomaid

import (
	"time"

	"faryne.dev/model/entity"
)

// User neko 的使用者（users_v2，2016 年版留下來的表）；舊會員第一次登入時才綁 Firebase（見規格 §2）
type User struct {
	Id          uint64  `gorm:"primaryKey"`
	FirebaseUid *string `gorm:"column:firebase_uid"`
	Username    string  // 舊站登入用的帳號；改版後註冊的是空字串
	Userpass    string  // 舊雜湊；搬進 Firebase 後清空（被合併的帳號保留，用來判斷「已合併」）
	Email       string
	CreatedOn   time.Time
	UpdatedAt   *time.Time
	IsDeleted   bool
	DeletedAt   *time.Time
	// MergedIntoId 同 email 驗證後被合併到哪個帳號
	MergedIntoId *uint64
	// VerificationSentAt 最後一次寄驗證信；超過 24 小時還沒驗證就會被清除
	VerificationSentAt *time.Time
	EmailVerifiedAt    *time.Time
}

func (User) TableName() string {
	return "users_v2"
}

// DisplayName 畫面上顯示的名稱：舊會員是帳號，改版後註冊的沒有帳號就用 email
func (u User) DisplayName() string {
	if u.Username != "" {
		return u.Username
	}
	return u.Email
}

// LoginRequest 登入表單：login 可以是帳號或 email；new_password／new_email 只在舊會員搬家遇到例外時才帶
type LoginRequest struct {
	Login       string `json:"login"`
	Password    string `json:"password"`
	NewPassword string `json:"new_password"`
	NewEmail    string `json:"new_email"`
}

// RegisterRequest 註冊表單
type RegisterRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

// PasswordResetRequest 忘記密碼
type PasswordResetRequest struct {
	Email string `json:"email"`
}

// AuthActionRequest 信件連結（驗證 email、重設密碼）送回來的內容
type AuthActionRequest struct {
	Mode        string `json:"mode"` // verifyEmail／resetPassword
	OobCode     string `json:"oob_code"`
	NewPassword string `json:"new_password"`
}

// AuthActionResult 信件連結處理結果；Merged 是驗證成功時一起併進來的舊帳號
type AuthActionResult struct {
	Email  string   `json:"email"`
	Merged []string `json:"merged"`
}

// AccountResponse 目前登入者的資訊（頁首、未驗證提示條用）
type AccountResponse struct {
	Id                   uint64     `json:"id"`
	Name                 string     `json:"name"`
	Email                string     `json:"email"`
	EmailVerified        bool       `json:"email_verified"`
	VerificationDeadline *time.Time `json:"verification_deadline"` // 未驗證時：超過這個時間就會被清除
}

// FavoriteAuthor 追蹤的畫師（users_fav_authors）
type FavoriteAuthor struct {
	UserId    uint64
	Site      string
	AuthorId  string
	CreatedOn *time.Time
}

func (FavoriteAuthor) TableName() string {
	return "users_fav_authors"
}

// FavoriteArtwork 收藏的作品（users_fav_artworks）
type FavoriteArtwork struct {
	UserId    uint64
	Site      string
	AuthorId  string
	ArtworkId string
	CreatedOn *time.Time
}

func (FavoriteArtwork) TableName() string {
	return "users_fav_artworks"
}

// FavoriteKeys 使用者所有收藏的 key（畫愛心／追蹤按鈕狀態用）：畫師 "site/author"、作品 "site/author/artwork"
type FavoriteKeys struct {
	Authors  []string `json:"authors"`
	Artworks []string `json:"artworks"`
}

// FavoriteAuthorItem 我的追蹤 → 畫師列表的一列
type FavoriteAuthorItem struct {
	Site      string                  `json:"site"`
	AuthorId  string                  `json:"author_id"`
	Nickname  string                  `json:"nickname"`
	CreatedOn *time.Time              `json:"created_on"`
	Artworks  []ArtworkSearchClearRow `json:"artworks" gorm:"-"` // 最新幾件作品（縮圖用；事後從 ES 補，不是 DB 欄位）
}

// FavoriteListRequest 我的追蹤列表分頁
type FavoriteListRequest struct {
	entity.CommonPaginationQueryRequest
}
