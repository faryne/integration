package storyteller

import "time"

// 作者動態：類 X 的短貼文，每個身份（本人或筆名）各自一條時間軸。
// user_id／profile_id 都是內部鍵，對外只輸出 pen_name。

const (
	// AuthorPostBodyMaxRunes／CommentBodyMaxRunes 是內文字數上限（含 [spoiler]／[r18] 標記本身）
	AuthorPostBodyMaxRunes = 1000
	CommentBodyMaxRunes    = 500
	// AuthorPostPageSize 是時間軸一頁的則數（置頂那則另計）
	AuthorPostPageSize = 20
)

type AuthorPost struct {
	ID              uint64     `gorm:"column:id;primaryKey"`
	PublicID        string     `gorm:"column:public_id"`
	UserID          uint64     `gorm:"column:user_id"`
	ProfileID       uint64     `gorm:"column:profile_id"`
	Body            string     `gorm:"column:body"`
	PinnedAt        *time.Time `gorm:"column:pinned_at"`
	AttachProjectID uint64     `gorm:"column:attach_project_id"`
	AttachStoryID   uint64     `gorm:"column:attach_story_id"`
	NotifiedAt      *time.Time `gorm:"column:notified_at"`
	IsDeleted       bool       `gorm:"column:is_deleted"`
	DeletedAt       *time.Time `gorm:"column:deleted_at"`
	// DeleteReason 是內部處置的理由 slug（見 moderation.go）；NULL＝使用者自己刪的
	DeleteReason *string   `gorm:"column:delete_reason"`
	CreatedAt    time.Time `gorm:"column:created_at"`
	UpdatedAt    time.Time `gorm:"column:updated_at"`
}

func (AuthorPost) TableName() string { return "storyteller_author_posts" }

// Identity 是發文身份鍵。
func (p *AuthorPost) Identity() AuthorIdentityKey {
	return AuthorIdentityKey{UserID: p.UserID, ProfileID: p.ProfileID}
}

// CommentTargetType 是留言掛在哪一種東西底下；之後的討論區沿用同一張表。
type CommentTargetType string

const (
	CommentTargetAuthorPost       CommentTargetType = "author_post"
	CommentTargetDiscussionThread CommentTargetType = "discussion_thread"
)

type Comment struct {
	ID         uint64            `gorm:"column:id;primaryKey"`
	PublicID   string            `gorm:"column:public_id"`
	TargetType CommentTargetType `gorm:"column:target_type"`
	TargetID   uint64            `gorm:"column:target_id"`
	// ParentID：0 = 頂層留言；回覆只掛在頂層底下（兩層）
	ParentID uint64 `gorm:"column:parent_id"`
	// ReplyToID：在同一串裡直接回覆的那則回覆；回覆頂層留言本身時為 0
	ReplyToID uint64 `gorm:"column:reply_to_id"`
	UserID    uint64 `gorm:"column:user_id"`
	ProfileID uint64 `gorm:"column:profile_id"`
	Body      string `gorm:"column:body"`
	// EditedAt 只有討論版的留言會有（動態留言不開放編輯）；舊版本另存在 edit_history 欄位
	EditedAt  *time.Time `gorm:"column:edited_at"`
	IsDeleted bool       `gorm:"column:is_deleted"`
	DeletedAt *time.Time `gorm:"column:deleted_at"`
	// DeleteReason 是內部處置的理由 slug（見 moderation.go）；NULL＝使用者自己刪的
	DeleteReason *string   `gorm:"column:delete_reason"`
	CreatedAt    time.Time `gorm:"column:created_at"`
}

func (Comment) TableName() string { return "storyteller_comments" }

func (c *Comment) Identity() AuthorIdentityKey {
	return AuthorIdentityKey{UserID: c.UserID, ProfileID: c.ProfileID}
}

// AuthorBlock：某個作者身份封鎖了某個帳號（不論對方用哪個身份）。
type AuthorBlock struct {
	ID            uint64     `gorm:"column:id;primaryKey"`
	PublicID      string     `gorm:"column:public_id"`
	UserID        uint64     `gorm:"column:user_id"`
	ProfileID     uint64     `gorm:"column:profile_id"`
	BlockedUserID uint64     `gorm:"column:blocked_user_id"`
	IsDeleted     bool       `gorm:"column:is_deleted"`
	DeletedAt     *time.Time `gorm:"column:deleted_at"`
	CreatedAt     time.Time  `gorm:"column:created_at"`
	UpdatedAt     time.Time  `gorm:"column:updated_at"`
}

func (AuthorBlock) TableName() string { return "storyteller_author_blocks" }

type AuthorPostLike struct {
	PostID    uint64    `gorm:"column:post_id;primaryKey"`
	UserID    uint64    `gorm:"column:user_id;primaryKey"`
	CreatedAt time.Time `gorm:"column:created_at"`
}

func (AuthorPostLike) TableName() string { return "storyteller_author_post_likes" }

// ---- 請求 ----

type AuthorPostRequest struct {
	Body string `json:"body"`
	// 作品卡：只填 project 是附整部作品，再填 story 是附某一話；都是 public_id
	AttachProjectPublicID string `json:"attach_project_public_id"`
	AttachStoryPublicID   string `json:"attach_story_public_id"`
}

type CommentRequest struct {
	Body string `json:"body"`
	// Parent 是要回覆的頂層留言；ReplyTo 是同一串裡要回覆的那則回覆（選填）
	Parent  string `json:"parent"`
	ReplyTo string `json:"reply_to"`
	// As 只在討論版有用：作品作者要用哪個署名身份發言（筆名；空白＝預設身份）
	As string `json:"as"`
}

// CommentEditRequest 是討論版留言的編輯（動態留言不開放編輯）。
type CommentEditRequest struct {
	Body string `json:"body"`
}

// ---- 輸出 ----

// AuthorPostAttachmentOutput 是作品卡；作品轉私密、刪除或那一話下架時只回 Unavailable。
type AuthorPostAttachmentOutput struct {
	Unavailable     bool          `json:"unavailable,omitempty"`
	ProjectPublicID string        `json:"project_public_id,omitempty"`
	ProjectSlug     string        `json:"project_slug,omitempty"`
	ProjectName     string        `json:"project_name,omitempty"`
	Rating          ProjectRating `json:"rating,omitempty"`
	CoverURL        string        `json:"cover_url,omitempty"`
	StoryPublicID   string        `json:"story_public_id,omitempty"`
	StoryTitle      string        `json:"story_title,omitempty"`
	VolumeTitle     string        `json:"volume_title,omitempty"`
}

type AuthorPostOutput struct {
	PublicID     string                      `json:"public_id"`
	Author       AuthorIdentityOutput        `json:"author"`
	Body         string                      `json:"body"`
	Pinned       bool                        `json:"pinned"`
	Attachment   *AuthorPostAttachmentOutput `json:"attachment,omitempty"`
	LikeCount    int64                       `json:"like_count"`
	CommentCount int64                       `json:"comment_count"`
	LikedByMe    bool                        `json:"liked_by_me"`
	IsOwner      bool                        `json:"is_owner"`
	CreatedAt    time.Time                   `json:"created_at"`
}

type AuthorPostListOutput struct {
	Items      []AuthorPostOutput `json:"items"`
	NextCursor string             `json:"next_cursor"`
	IsOwner    bool               `json:"is_owner"`
}

// CommentReplyToOutput 是「↪ 回覆 @某人」：被回覆的那則已刪除時 Deleted=true、不帶名字。
type CommentReplyToOutput struct {
	PublicID string `json:"public_id,omitempty"`
	PenName  string `json:"pen_name,omitempty"`
	Deleted  bool   `json:"deleted,omitempty"`
}

// CommentOutput：已刪除的留言只留佔位（Deleted=true，不帶身份、內文與時間以外的資訊）。
type CommentOutput struct {
	PublicID string `json:"public_id"`
	Deleted  bool   `json:"deleted,omitempty"`
	// DeleteReason 只在站方移除時有值（理由 slug）；本人刪除為空
	DeleteReason string `json:"delete_reason,omitempty"`
	// IsMine：看的人就是留言者（任一身份），前端用來隱藏「檢舉」
	IsMine bool                  `json:"is_mine,omitempty"`
	Author *AuthorIdentityOutput `json:"author,omitempty"`
	// IsPostAuthor：留言者是作者（動態＝貼文的身份；討論版＝作品擁有者的任一署名身份），前端顯示「作者」標籤
	IsPostAuthor bool                  `json:"is_post_author,omitempty"`
	Edited       bool                  `json:"edited,omitempty"`
	CanEdit      bool                  `json:"can_edit,omitempty"`
	Body         string                `json:"body,omitempty"`
	ReplyTo      *CommentReplyToOutput `json:"reply_to,omitempty"`
	CanDelete    bool                  `json:"can_delete,omitempty"`
	CanBlock     bool                  `json:"can_block,omitempty"`
	// Blocked 只輸出給貼文擁有者：這位留言者已被這個身份封鎖
	Blocked   bool            `json:"blocked,omitempty"`
	Replies   []CommentOutput `json:"replies,omitempty"`
	CreatedAt *time.Time      `json:"created_at,omitempty"`
}

// CommentViewerState 是看貼文的人能不能留言：login／pen_name／blocked 對應前端三種提示。
type CommentViewerState string

const (
	CommentViewerCanComment    CommentViewerState = "ok"
	CommentViewerLoginRequired CommentViewerState = "login"
	CommentViewerNeedPenName   CommentViewerState = "pen_name"
	CommentViewerBlocked       CommentViewerState = "blocked"
)

type AuthorPostDetailOutput struct {
	Post         AuthorPostOutput   `json:"post"`
	Comments     []CommentOutput    `json:"comments"`
	CommentState CommentViewerState `json:"comment_state"`
	// CommentAs 是可以留言時會用的身份（在自己貼文底下就是貼文的身份）
	CommentAs string `json:"comment_as,omitempty"`
}

// AttachableWorkOutput 是作品卡候選：發文身份署名、目前公開的作品，與其下公開的話（新到舊）。
type AttachableWorkOutput struct {
	ProjectPublicID string                  `json:"project_public_id"`
	ProjectName     string                  `json:"project_name"`
	Rating          ProjectRating           `json:"rating"`
	Stories         []AttachableStoryOutput `json:"stories"`
}

type AttachableStoryOutput struct {
	PublicID    string `json:"public_id"`
	Title       string `json:"title"`
	VolumeTitle string `json:"volume_title,omitempty"`
}

type AuthorBlockOutput struct {
	PublicID  string               `json:"public_id"`
	Blocked   AuthorIdentityOutput `json:"blocked"`
	CreatedAt time.Time            `json:"created_at"`
}
