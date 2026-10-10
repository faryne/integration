package storyteller

import (
	"slices"
	"time"
)

// 檢舉與內部處置。理由只存 slug（reason_key），顯示文字由前端以 moderation.reason.<slug> 對照；
// 各內容表的 delete_reason 也存同一個 slug，NULL 代表使用者自己刪的。

// ReportTargetType 是檢舉紀錄裡存的對象種類（作者會解析成 user 或 author_profile）。
type ReportTargetType string

const (
	ReportTargetProject          ReportTargetType = "project"
	ReportTargetStory            ReportTargetType = "story"
	ReportTargetLore             ReportTargetType = "lore"
	ReportTargetUser             ReportTargetType = "user"
	ReportTargetAuthorProfile    ReportTargetType = "author_profile"
	ReportTargetAuthorPost       ReportTargetType = "author_post"
	ReportTargetDiscussionThread ReportTargetType = "discussion_thread"
	ReportTargetComment          ReportTargetType = "comment"
	// ReportTargetAuthor 只出現在請求：前端以筆名檢舉創作者，後端再解析成 user／author_profile
	ReportTargetAuthor ReportTargetType = "author"
)

// ModerationReasonOther 是「其他」：檢舉時補充說明必填。
const ModerationReasonOther = "other"

// ReportNoteMaxRunes 是檢舉補充說明的字數上限。
const ReportNoteMaxRunes = 1000

type ReportStatus string

const (
	ReportStatusPending   ReportStatus = "pending"
	ReportStatusResolved  ReportStatus = "resolved"
	ReportStatusDismissed ReportStatus = "dismissed"
)

type ModerationReason struct {
	ID        uint64 `gorm:"column:id;primaryKey"`
	ReasonKey string `gorm:"column:reason_key"`
	// AppliesTo 是適用的對象種類；空＝全部適用
	AppliesTo    StringList `gorm:"column:applies_to;type:json"`
	IsReportable bool       `gorm:"column:is_reportable"`
	SortOrder    int        `gorm:"column:sort_order"`
	IsDeleted    bool       `gorm:"column:is_deleted"`
	DeletedAt    *time.Time `gorm:"column:deleted_at"`
	CreatedAt    time.Time  `gorm:"column:created_at"`
	UpdatedAt    time.Time  `gorm:"column:updated_at"`
}

func (ModerationReason) TableName() string { return "storyteller_moderation_reasons" }

// AppliesToTarget：作者（請求用的 author）只要 user／author_profile 任一適用就算。
func (r *ModerationReason) AppliesToTarget(target ReportTargetType) bool {
	if len(r.AppliesTo) == 0 {
		return true
	}
	if target == ReportTargetAuthor {
		return slices.Contains(r.AppliesTo, string(ReportTargetUser)) || slices.Contains(r.AppliesTo, string(ReportTargetAuthorProfile))
	}
	return slices.Contains(r.AppliesTo, string(target))
}

type Report struct {
	ID              uint64           `gorm:"column:id;primaryKey"`
	PublicID        string           `gorm:"column:public_id"`
	ReporterUserID  uint64           `gorm:"column:reporter_user_id"`
	TargetType      ReportTargetType `gorm:"column:target_type"`
	TargetID        uint64           `gorm:"column:target_id"`
	ReasonKey       string           `gorm:"column:reason_key"`
	Note            *string          `gorm:"column:note"`
	Status          ReportStatus     `gorm:"column:status"`
	HandledByUserID *uint64          `gorm:"column:handled_by_user_id"`
	HandledAt       *time.Time       `gorm:"column:handled_at"`
	CreatedAt       time.Time        `gorm:"column:created_at"`
	UpdatedAt       time.Time        `gorm:"column:updated_at"`
}

func (Report) TableName() string { return "storyteller_reports" }

// ReportRequest：作品／討論串／留言／動態以 public_id 指定；故事與設定另帶 project_public_id；
// 創作者 target_public_id 帶筆名。不公開作品裡的東西要帶 share（分享 token）。
type ReportRequest struct {
	TargetType      ReportTargetType `json:"target_type"`
	TargetPublicID  string           `json:"target_public_id"`
	ProjectPublicID string           `json:"project_public_id"`
	Share           string           `json:"share"`
	ReasonKey       string           `json:"reason_key"`
	Note            string           `json:"note"`
}

// ModerationReasonOutput：NoteRequired 讓前端不用寫死「其他」要必填。
type ModerationReasonOutput struct {
	Key          string `json:"key"`
	NoteRequired bool   `json:"note_required,omitempty"`
}
