package av

import (
	"time"

	"faryne.dev/model/entity"
)

// DMMVideoSubmission 影片修改提交單（dmm_video_submissions）；狀態與審核欄位跟女優提交單相同，只有修改、沒有新增
type DMMVideoSubmission struct {
	ID uint64 `gorm:"column:id;primaryKey" json:"id"`
	// TargetVid ES dmmvideos 的 document id（= dmm.id）；TargetNo 提交當下的內部番號（列表顯示、除錯用）
	TargetVid       int        `gorm:"column:target_vid" json:"target_vid"`
	TargetNo        string     `gorm:"column:target_no" json:"target_no"`
	Payload         string     `gorm:"column:payload" json:"-"`
	BaseSnapshot    string     `gorm:"column:base_snapshot" json:"-"`
	ChangedFields   string     `gorm:"column:changed_fields" json:"-"`
	Channel         string     `gorm:"column:channel" json:"channel"`
	SubmitterUserID *uint64    `gorm:"column:submitter_user_id" json:"submitter_user_id"`
	SubmitterIPHash string     `gorm:"column:submitter_ip_hash" json:"-"`
	Status          string     `gorm:"column:status" json:"status"`
	ReviewerUserID  *uint64    `gorm:"column:reviewer_user_id" json:"reviewer_user_id"`
	ReviewNote      string     `gorm:"column:review_note" json:"review_note"`
	ReviewedAt      *time.Time `gorm:"column:reviewed_at" json:"reviewed_at"`
	CreatedAt       time.Time  `gorm:"column:created_at" json:"created_at"`
	UpdatedAt       time.Time  `gorm:"column:updated_at" json:"updated_at"`
}

func (DMMVideoSubmission) TableName() string {
	return "dmm_video_submissions"
}

// DMMVideoOverride 核准過的手動修改（dmm_video_overrides）：只存被改的欄位，DMM 同步寫 ES 前會蓋回去
type DMMVideoOverride struct {
	Vid       int       `gorm:"column:vid;primaryKey"`
	Overrides string    `gorm:"column:overrides"`
	UpdatedAt time.Time `gorm:"column:updated_at"`
}

func (DMMVideoOverride) TableName() string {
	return "dmm_video_overrides"
}

// VideoSubmitRequest 提交修改：網頁用 TargetNo（詳細頁的內部番號）；MCP 用 Target（官方番號或內部番號）
type VideoSubmitRequest struct {
	TargetNo string      `json:"target_no"`
	Target   string      `json:"target"`
	Fields   VideoFields `json:"fields"`
}

// VideoSubmitResult 提交結果；NewValues 是整個影片庫都還沒出現過的值（欄位 → 值），讓提交者自己檢查有沒有打錯
type VideoSubmitResult struct {
	ID            uint64              `json:"id"`
	Status        string              `json:"status"`
	ChangedFields []string            `json:"changed_fields"`
	NewValues     map[string][]string `json:"new_values"`
}

// VideoSubmissionStatus 給提交者查詢的公開狀態
type VideoSubmissionStatus struct {
	ID         uint64     `json:"id"`
	No         string     `json:"no"`
	Title      string     `json:"title"`
	Status     string     `json:"status"`
	ReviewNote string     `json:"review_note"`
	CreatedAt  time.Time  `json:"created_at"`
	ReviewedAt *time.Time `json:"reviewed_at"`
}

// VideoSubmissionListRequest 管理列表
type VideoSubmissionListRequest struct {
	entity.CommonPaginationQueryRequest
	Status string `query:"status"`
}

// VideoSubmissionSummary 管理列表的一列；MakerNo 是提交當下的官方番號（沒有就顯示內部番號）；
// Conflict 提交後影片資料被改過；Missing 目標影片在 ES 已經找不到
type VideoSubmissionSummary struct {
	DMMVideoSubmission
	Title         string   `json:"title"`
	MakerNo       string   `json:"maker_no"`
	ChangedFields []string `json:"changed_fields"`
	IPHashPrefix  string   `json:"ip_hash_prefix"`
	Conflict      bool     `json:"conflict"`
	Missing       bool     `json:"missing"`
}

// VideoRef 審核頁提醒用的另一部影片（官方番號重複）
type VideoRef struct {
	No      string `json:"no"`
	MakerNo string `json:"maker_no"`
	Title   string `json:"title"`
}

// VideoSubmissionDetail 審核頁：提交內容、提交當下與現在的資料，以及各種提醒
type VideoSubmissionDetail struct {
	VideoSubmissionSummary
	Payload VideoFields  `json:"payload"`
	Base    VideoFields  `json:"base"`
	Current *VideoFields `json:"current"`
	Thumb   string       `json:"thumb"`
	// NewValues 影片庫裡還沒有的值；MakerNoTaken 官方番號已經被別部影片使用；
	// SameNameActresses 新加的出演是有同名問題的女優（分不出是哪一位）
	NewValues         map[string][]string `json:"new_values"`
	MakerNoTaken      []VideoRef          `json:"maker_no_taken"`
	SameNameActresses []string            `json:"same_name_actresses"`
}
