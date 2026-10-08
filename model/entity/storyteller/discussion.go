package storyteller

import "time"

// 專案討論版：討論串屬於專案，可以錨定在某一話或某篇設定；回覆沿用 Comment（target_type = discussion_thread）。
// 公開與不公開（僅限連結）的作品才有討論版，私人作品沒有。

type DiscussionAnchorType string

const (
	DiscussionAnchorNone  DiscussionAnchorType = ""
	DiscussionAnchorStory DiscussionAnchorType = "story"
	DiscussionAnchorLore  DiscussionAnchorType = "lore"
)

const (
	// 字數不在畫面上顯示，只留寬鬆上限防止灌爆
	DiscussionTitleMaxRunes   = 100
	DiscussionBodyMaxRunes    = 10000
	DiscussionCommentMaxRunes = 5000
	DiscussionPageSize        = 30
)

type DiscussionThread struct {
	ID         uint64               `gorm:"column:id;primaryKey"`
	PublicID   string               `gorm:"column:public_id"`
	ProjectID  uint64               `gorm:"column:project_id"`
	AnchorType DiscussionAnchorType `gorm:"column:anchor_type"`
	AnchorID   uint64               `gorm:"column:anchor_id"`
	UserID     uint64               `gorm:"column:user_id"`
	ProfileID  uint64               `gorm:"column:profile_id"`
	Title      string               `gorm:"column:title"`
	Body       string               `gorm:"column:body"`
	// 舊版本存在 edit_history 欄位（v1 不讀取、不顯示），這裡只對應編輯時間
	EditedAt       *time.Time `gorm:"column:edited_at"`
	LockedAt       *time.Time `gorm:"column:locked_at"`
	LastActivityAt time.Time  `gorm:"column:last_activity_at"`
	IsDeleted      bool       `gorm:"column:is_deleted"`
	DeletedAt      *time.Time `gorm:"column:deleted_at"`
	CreatedAt      time.Time  `gorm:"column:created_at"`
	UpdatedAt      time.Time  `gorm:"column:updated_at"`
}

func (DiscussionThread) TableName() string { return "storyteller_discussion_threads" }

func (t *DiscussionThread) Identity() AuthorIdentityKey {
	return AuthorIdentityKey{UserID: t.UserID, ProfileID: t.ProfileID}
}

// ---- 請求 ----

type DiscussionThreadRequest struct {
	Title string `json:"title"`
	Body  string `json:"body"`
	// 錨點擇一：故事（某一話）或設定的 public_id；都空白是一般討論
	AnchorStory string `json:"anchor_story"`
	AnchorLore  string `json:"anchor_lore"`
	// As 只對作品作者有用：用哪個署名身份發起（筆名；空白＝預設身份）
	As string `json:"as"`
}

type DiscussionThreadEditRequest struct {
	Title string `json:"title"`
	Body  string `json:"body"`
}

// DiscussionListFilter：all 全部／general 一般／story 故事／lore 設定
type DiscussionListFilter string

const (
	DiscussionFilterAll     DiscussionListFilter = "all"
	DiscussionFilterGeneral DiscussionListFilter = "general"
	DiscussionFilterStory   DiscussionListFilter = "story"
	DiscussionFilterLore    DiscussionListFilter = "lore"
)

// DiscussionListQuery：anchor_story／anchor_lore 給閱讀頁 modal 只列錨定某一話／某篇設定的串
type DiscussionListQuery struct {
	Filter      DiscussionListFilter `query:"filter"`
	Sort        string               `query:"sort"` // latest 最新回覆（預設）／newest 最新發起
	AnchorStory string               `query:"anchor_story"`
	AnchorLore  string               `query:"anchor_lore"`
	Page        int                  `query:"page"`
	Share       string               `query:"share"` // 不公開作品的分享 token
}

// ---- 輸出 ----

// DiscussionAnchorOutput：錨點已不可見（下架、刪除）時只有 Unavailable。防劇透由前端依閱讀進度判斷。
type DiscussionAnchorOutput struct {
	Type        DiscussionAnchorType `json:"type"`
	PublicID    string               `json:"public_id,omitempty"`
	Title       string               `json:"title,omitempty"`
	VolumeTitle string               `json:"volume_title,omitempty"`
	Unavailable bool                 `json:"unavailable,omitempty"`
}

type DiscussionThreadOutput struct {
	PublicID string `json:"public_id"`
	Title    string `json:"title"`
	// Body 只有單串詳情會帶，列表不帶
	Body string `json:"body,omitempty"`
	// Author 為 nil 代表發串者身份已不存在
	Author          *AuthorIdentityOutput   `json:"author,omitempty"`
	IsProjectAuthor bool                    `json:"is_project_author,omitempty"`
	Anchor          *DiscussionAnchorOutput `json:"anchor,omitempty"`
	ReplyCount      int64                   `json:"reply_count"`
	Edited          bool                    `json:"edited,omitempty"`
	Locked          bool                    `json:"locked,omitempty"`
	CanEdit         bool                    `json:"can_edit,omitempty"`
	CanDelete       bool                    `json:"can_delete,omitempty"`
	CanLock         bool                    `json:"can_lock,omitempty"`
	CanBlock        bool                    `json:"can_block,omitempty"`
	// Blocked 只輸出給作品作者：發串者已被封鎖
	Blocked        bool      `json:"blocked,omitempty"`
	LastActivityAt time.Time `json:"last_activity_at"`
	CreatedAt      time.Time `json:"created_at"`
}

// DiscussionViewerOutput 是看的人能不能發言、可以用哪些身份（作者＝作品署名過的身份，讀者＝本人）。
type DiscussionViewerOutput struct {
	State CommentViewerState `json:"state"`
	As    []string           `json:"as,omitempty"`
}

type DiscussionListOutput struct {
	Items  []DiscussionThreadOutput `json:"items"`
	Total  int64                    `json:"total"`
	Page   int                      `json:"page"`
	Viewer DiscussionViewerOutput   `json:"viewer"`
}

type DiscussionThreadDetailOutput struct {
	Thread   DiscussionThreadOutput `json:"thread"`
	Comments []CommentOutput        `json:"comments"`
	Viewer   DiscussionViewerOutput `json:"viewer"`
}
