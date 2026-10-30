package av

import (
	"time"

	"faryne.dev/model/entity"
)

// 提交單類型、狀態、核准結果與來源管道
const (
	SubmissionKindCreate = "create"
	SubmissionKindEdit   = "edit"

	SubmissionStatusPending  = "pending"
	SubmissionStatusApproved = "approved"
	SubmissionStatusRejected = "rejected"

	SubmissionResolutionCreated = "created"
	SubmissionResolutionUpdated = "updated"
	SubmissionResolutionMerged  = "merged"

	SubmissionChannelWeb = "web"
	SubmissionChannelMCP = "mcp"

	// ActressDomainManual 手動上稿新增的女優
	ActressDomainManual = "manual"
)

// DMMActressSubmission 女優上稿提交單（dmm_actress_submissions）
type DMMActressSubmission struct {
	ID              uint64     `gorm:"column:id;primaryKey" json:"id"`
	Kind            string     `gorm:"column:kind" json:"kind"`
	TargetDomain    string     `gorm:"column:target_domain" json:"target_domain"`
	TargetAID       int        `gorm:"column:target_aid" json:"target_aid"`
	Payload         string     `gorm:"column:payload" json:"-"`
	BaseSnapshot    *string    `gorm:"column:base_snapshot" json:"-"`
	ChangedFields   string     `gorm:"column:changed_fields" json:"-"`
	Channel         string     `gorm:"column:channel" json:"channel"`
	SubmitterUserID *uint64    `gorm:"column:submitter_user_id" json:"submitter_user_id"`
	SubmitterIPHash string     `gorm:"column:submitter_ip_hash" json:"-"`
	Status          string     `gorm:"column:status" json:"status"`
	Resolution      string     `gorm:"column:resolution" json:"resolution"`
	MergedDomain    string     `gorm:"column:merged_domain" json:"merged_domain"`
	MergedAID       int        `gorm:"column:merged_aid" json:"merged_aid"`
	ReviewerUserID  *uint64    `gorm:"column:reviewer_user_id" json:"reviewer_user_id"`
	ReviewNote      string     `gorm:"column:review_note" json:"review_note"`
	ReviewedAt      *time.Time `gorm:"column:reviewed_at" json:"reviewed_at"`
	CreatedAt       time.Time  `gorm:"column:created_at" json:"created_at"`
	UpdatedAt       time.Time  `gorm:"column:updated_at" json:"updated_at"`
}

func (DMMActressSubmission) TableName() string {
	return "dmm_actress_submissions"
}

// ActressSubmitRequest 提交新增／修改。修改時以 TargetDomain＋TargetAID 指定女優（網頁），
// 或用 Target 傳姓名／「domain-aid」（MCP）
type ActressSubmitRequest struct {
	Kind         string        `json:"kind"`
	TargetDomain string        `json:"target_domain"`
	TargetAID    int           `json:"target_aid"`
	Target       string        `json:"target"`
	Fields       ActressFields `json:"fields"`
}

// ActressSubmitResult 提交結果：提交單編號、有變更的欄位、同名或同假名的女優
type ActressSubmitResult struct {
	ID            uint64             `json:"id"`
	Status        string             `json:"status"`
	ChangedFields []string           `json:"changed_fields"`
	Duplicates    []ActressCandidate `json:"duplicates"`
}

// ActressCandidate 可能重複的女優；ExactName 為 true 表示姓名完全相同（核准時要選合併或新增為另一位）
type ActressCandidate struct {
	Domain    string        `json:"domain"`
	AID       int           `json:"aid"`
	ExactName bool          `json:"exact_name"`
	Fields    ActressFields `json:"fields"`
}

// ActressSubmissionStatus 給提交者查詢的公開狀態
type ActressSubmissionStatus struct {
	ID         uint64     `json:"id"`
	Kind       string     `json:"kind"`
	Name       string     `json:"name"`
	Status     string     `json:"status"`
	Resolution string     `json:"resolution"`
	ReviewNote string     `json:"review_note"`
	CreatedAt  time.Time  `json:"created_at"`
	ReviewedAt *time.Time `json:"reviewed_at"`
}

// ActressSubmissionListRequest 管理列表
type ActressSubmissionListRequest struct {
	entity.CommonPaginationQueryRequest
	Status string `query:"status"`
}

// ActressSubmissionSummary 管理列表的一列
type ActressSubmissionSummary struct {
	DMMActressSubmission
	Name          string   `json:"name"`
	ChangedFields []string `json:"changed_fields"`
	IPHashPrefix  string   `json:"ip_hash_prefix"`
	// Conflict 修改單的目標女優在提交後被改過；Duplicate 新增單有同名女優
	Conflict  bool `json:"conflict"`
	Duplicate bool `json:"duplicate"`
}

// ActressSubmissionDetail 審核頁：提交內容、提交當下與現在的資料、同名候選
type ActressSubmissionDetail struct {
	ActressSubmissionSummary
	Payload    ActressFields      `json:"payload"`
	Base       *ActressFields     `json:"base"`
	Current    *ActressFields     `json:"current"`
	Duplicates []ActressCandidate `json:"duplicates"`
}

// ActressMergeTargetNew 新增單遇到同名時，核准成另一位女優（不合併）
const ActressMergeTargetNew = "new"

// ActressSubmissionApproveRequest 核准；新增單有同名女優時必須指定合併到哪一位（domain-aid），或 new 新增為另一位
type ActressSubmissionApproveRequest struct {
	MergeTarget string `json:"merge_target"`
}

// ActressSubmissionRejectRequest 否決
type ActressSubmissionRejectRequest struct {
	ReviewNote string `json:"review_note"`
}
