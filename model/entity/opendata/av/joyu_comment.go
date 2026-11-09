package av

import "time"

// joyu.fyi 討論版。規格見 DevelopDocuments/opendata/joyu.fyi社群功能第二期_2026-11-09.md

// 留言掛在哪裡
const (
	CommentTargetActress = "actress"
	CommentTargetVideo   = "video"
)

// 封鎖的對象
const (
	JoyuBanUID = "uid"
	JoyuBanIP  = "ip"
)

// CommentReportReasons 檢舉原因：垃圾訊息、騷擾、個資、其他
var CommentReportReasons = []string{"spam", "harass", "privacy", "other"}

// JoyuUser joyu 帳號的站內資料：只有暱稱與刪除狀態
type JoyuUser struct {
	FirebaseUID string     `gorm:"column:firebase_uid;primaryKey"`
	Nickname    string     `gorm:"column:nickname"`
	IsDeleted   bool       `gorm:"column:is_deleted"`
	DeletedAt   *time.Time `gorm:"column:deleted_at"`
	CreatedAt   *time.Time `gorm:"column:created_at"`
	UpdatedAt   *time.Time `gorm:"column:updated_at"`
}

func (JoyuUser) TableName() string {
	return "joyu_users"
}

// JoyuComment 一則留言（頂層或回覆）
type JoyuComment struct {
	ID          uint64     `gorm:"column:id;primaryKey"`
	TargetType  string     `gorm:"column:target_type"`
	TargetKey   string     `gorm:"column:target_key"`
	FirebaseUID string     `gorm:"column:firebase_uid"`
	IsAnonymous bool       `gorm:"column:is_anonymous"`
	Body        string     `gorm:"column:body"`
	ParentID    uint64     `gorm:"column:parent_id"`
	ReplyToUID  string     `gorm:"column:reply_to_uid"`
	IP          string     `gorm:"column:ip"`
	ReportCount int        `gorm:"column:report_count"`
	IsDeleted   bool       `gorm:"column:is_deleted"`
	DeletedAt   *time.Time `gorm:"column:deleted_at"`
	DeletedBy   uint64     `gorm:"column:deleted_by"`
	CreatedAt   *time.Time `gorm:"column:created_at"`
}

func (JoyuComment) TableName() string {
	return "joyu_comments"
}

type JoyuCommentReport struct {
	CommentID   uint64     `gorm:"column:comment_id;primaryKey"`
	FirebaseUID string     `gorm:"column:firebase_uid;primaryKey"`
	Reason      string     `gorm:"column:reason"`
	IP          string     `gorm:"column:ip"`
	CreatedAt   *time.Time `gorm:"column:created_at"`
}

func (JoyuCommentReport) TableName() string {
	return "joyu_comment_reports"
}

type JoyuBan struct {
	ID        uint64     `gorm:"column:id;primaryKey" json:"id"`
	BanType   string     `gorm:"column:ban_type" json:"ban_type"`
	Value     string     `gorm:"column:value" json:"value"`
	Reason    string     `gorm:"column:reason" json:"reason"`
	ExpiresAt *time.Time `gorm:"column:expires_at" json:"expires_at"`
	CreatedBy uint64     `gorm:"column:created_by" json:"created_by"`
	IsDeleted bool       `gorm:"column:is_deleted" json:"-"`
	DeletedAt *time.Time `gorm:"column:deleted_at" json:"-"`
	CreatedAt *time.Time `gorm:"column:created_at" json:"created_at"`
}

func (JoyuBan) TableName() string {
	return "joyu_bans"
}

// JoyuCommentRequest 送出留言；Target 是「video:midv00900」或「actress:xcity:22105」，ReplyTo 是要回覆的留言 id（頂層或回覆）
type JoyuCommentRequest struct {
	Target  string `json:"target"`
	Body    string `json:"body"`
	ReplyTo uint64 `json:"reply_to"`
}

type JoyuCommentReportRequest struct {
	Reason string `json:"reason"`
}

type JoyuProfileRequest struct {
	Nickname string `json:"nickname"`
}

// JoyuCommentAuthor 留言者的公開資料：不含 uid 與 IP。Kind：anonymous／google／deleted
type JoyuCommentAuthor struct {
	Name string `json:"name"`
	Kind string `json:"kind"`
}

// JoyuCommentView 公開的一則留言；被管理員刪除時 Body 是空字串、Deleted 為 true
type JoyuCommentView struct {
	ID        uint64             `json:"id"`
	Author    JoyuCommentAuthor  `json:"author"`
	Body      string             `json:"body"`
	Deleted   bool               `json:"deleted"`
	ReplyTo   *JoyuCommentAuthor `json:"reply_to,omitempty"`
	CreatedAt *time.Time         `json:"created_at"`
	// 以下只有頂層留言有：回覆總數與最新幾則（依時間先舊後新）
	ReplyCount int               `json:"reply_count"`
	Replies    []JoyuCommentView `json:"replies,omitempty"`
}

// JoyuCommentPage 一頁頂層留言；Count 是這個討論版全部留言數（含回覆、不含被刪的），分頁標題顯示用
type JoyuCommentPage struct {
	Count   int64             `json:"count"`
	Total   int64             `json:"total"`
	Page    int               `json:"page"`
	PerPage int               `json:"per_page"`
	Data    []JoyuCommentView `json:"data"`
}

// JoyuProfile 個人資料頁
type JoyuProfile struct {
	Nickname    string `json:"nickname"`
	DisplayName string `json:"display_name"`
	CanEdit     bool   `json:"can_edit"`
}

// JoyuAdminComment 後台列表的一則留言：多了 uid、IP、帳號類型與檢舉次數
type JoyuAdminComment struct {
	ID          uint64     `json:"id"`
	TargetType  string     `json:"target_type"`
	TargetKey   string     `json:"target_key"`
	FirebaseUID string     `json:"firebase_uid"`
	AuthorName  string     `json:"author_name"`
	IsAnonymous bool       `json:"is_anonymous"`
	Body        string     `json:"body"`
	ParentID    uint64     `json:"parent_id"`
	IP          string     `json:"ip"`
	ReportCount int        `json:"report_count"`
	IsDeleted   bool       `json:"is_deleted"`
	CreatedAt   *time.Time `json:"created_at"`
	// Reasons 各檢舉原因的次數
	Reasons map[string]int `json:"reasons,omitempty"`
}

// JoyuBanRequest 後台封鎖；Days 為 0 是永久
type JoyuBanRequest struct {
	BanType string `json:"ban_type"`
	Value   string `json:"value"`
	Days    int    `json:"days"`
	Reason  string `json:"reason"`
}
