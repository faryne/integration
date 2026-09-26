package storyteller

import "time"

type AssistantMemoryScope string

const (
	AssistantMemoryScopeProject AssistantMemoryScope = "project"
	AssistantMemoryScopeStory   AssistantMemoryScope = "story"
	AssistantMemoryScopeLore    AssistantMemoryScope = "lore"
)

type AssistantMemoryKind string

const (
	AssistantMemoryKindPreference  AssistantMemoryKind = "preference"
	AssistantMemoryKindInstruction AssistantMemoryKind = "instruction"
	AssistantMemoryKindDecision    AssistantMemoryKind = "decision"
	AssistantMemoryKindContext     AssistantMemoryKind = "context"
)

type AssistantMemoryStatus string

const (
	AssistantMemoryStatusInProgress AssistantMemoryStatus = "in_progress"
	AssistantMemoryStatusCompleted  AssistantMemoryStatus = "completed"
	AssistantMemoryStatusFailed     AssistantMemoryStatus = "failed"
	AssistantMemoryStatusConfirmed  AssistantMemoryStatus = "confirmed"
)

// AssistantMemory 是梭梭保存的原子記憶。ScopeType 與三個目標 ID 的合法組合由
// service 保證；PublicID 只識別記憶本身，不代表作用域目標。
type AssistantMemory struct {
	ID                 uint64                `gorm:"column:id;primaryKey" json:"-"`
	PublicID           string                `gorm:"column:public_id" json:"public_id"`
	MemoryName         *string               `gorm:"column:memory_name" json:"memory_name,omitempty"`
	UserID             uint64                `gorm:"column:user_id" json:"-"`
	ScopeType          AssistantMemoryScope  `gorm:"column:scope_type" json:"scope_type"`
	ProjectID          *uint64               `gorm:"column:project_id" json:"-"`
	StoryID            *uint64               `gorm:"column:story_id" json:"-"`
	LoreID             *uint64               `gorm:"column:lore_id" json:"-"`
	SourceChatID       *uint64               `gorm:"column:source_chat_id" json:"-"`
	ProviderAPIKeyID   *uint64               `gorm:"column:provider_apikey_id" json:"-"`
	ModelName          *string               `gorm:"column:model_name" json:"-"`
	InputTokens        *uint                 `gorm:"column:input_tokens" json:"-"`
	OutputTokens       *uint                 `gorm:"column:output_tokens" json:"-"`
	Status             AssistantMemoryStatus `gorm:"column:status" json:"status"`
	ShouldRemember     *bool                 `gorm:"column:should_remember" json:"should_remember,omitempty"`
	SupersedesPublicID *string               `gorm:"column:supersedes_public_id" json:"supersedes_public_id,omitempty"`
	ErrorMessage       *string               `gorm:"column:error_message" json:"error_message,omitempty"`
	Kind               AssistantMemoryKind   `gorm:"column:kind" json:"kind"`
	Tags               string                `gorm:"column:tags" json:"-"`
	Content            string                `gorm:"column:content" json:"content"`
	Priority           uint8                 `gorm:"column:priority" json:"priority"`
	IsPinned           bool                  `gorm:"column:is_pinned" json:"is_pinned"`
	SupersededByID     *uint64               `gorm:"column:superseded_by_id" json:"-"`
	IsDeleted          bool                  `gorm:"column:is_deleted" json:"-"`
	DeletedAt          *time.Time            `gorm:"column:deleted_at" json:"-"`
	ConfirmedAt        *time.Time            `gorm:"column:confirmed_at" json:"confirmed_at,omitempty"`
	CreatedAt          time.Time             `gorm:"column:created_at" json:"created_at"`
	UpdatedAt          time.Time             `gorm:"column:updated_at" json:"updated_at"`
}

func (AssistantMemory) TableName() string { return "storyteller_assistant_memories" }

// AssistantMemorySource 保留一筆記憶由哪些對話訊息整理而來；刪除來源訊息只會
// 移除關聯，不會連帶刪除已經形成的記憶。
type AssistantMemorySource struct {
	ID        uint64    `gorm:"column:id;primaryKey" json:"-"`
	MemoryID  uint64    `gorm:"column:memory_id" json:"-"`
	MessageID uint64    `gorm:"column:message_id" json:"message_id"`
	CreatedAt time.Time `gorm:"column:created_at" json:"created_at"`
}

func (AssistantMemorySource) TableName() string { return "storyteller_assistant_memory_sources" }

// AssistantMemoryOutput 對外只暴露 public_id；TargetPublicID 依 ScopeType 指向
// project、story 或 lore。
type AssistantMemoryOutput struct {
	PublicID       string               `json:"public_id"`
	MemoryName     string               `json:"memory_name,omitempty"`
	ScopeType      AssistantMemoryScope `json:"scope_type"`
	TargetPublicID string               `json:"target_public_id,omitempty"`
	TargetName     string               `json:"target_name,omitempty"`
	Kind           AssistantMemoryKind  `json:"kind"`
	Tags           []string             `json:"tags"`
	Content        string               `json:"content"`
	Priority       uint8                `json:"priority"`
	IsPinned       bool                 `json:"is_pinned"`
	CreatedAt      time.Time            `json:"created_at"`
	UpdatedAt      time.Time            `json:"updated_at"`
}

// AssistantMemoryManagementRow 是管理頁查詢的 repository projection；嵌入原始
// 記憶欄位，再補上 story/lore 的可讀識別資訊，避免 service 逐筆查詢造成 N+1。
type AssistantMemoryManagementRow struct {
	AssistantMemory
	TargetPublicID string `gorm:"column:target_public_id"`
	TargetName     string `gorm:"column:target_name"`
}

type AssistantMemoryManagementFilter struct {
	Keyword        string
	MemoryPublicID string
	ScopeType      AssistantMemoryScope
	Kind           AssistantMemoryKind
	Tag            string
	IsPinned       *bool
	StoryID        *uint64
	LoreID         *uint64
	Offset         int
	Limit          int
}

type AssistantMemoryPageOutput struct {
	Memories   []AssistantMemoryOutput `json:"memories"`
	TotalCount int64                   `json:"total_count"`
	Page       int                     `json:"page"`
	PageSize   int                     `json:"page_size"`
}

type AssistantMemoryGenerateRequest struct {
	ProviderAPIKeyID *uint64 `json:"provider_apikey_id"`
	ModelName        string  `json:"model_name"`
}

type AssistantMemoryConfirmRequest struct {
	MemoryName    string               `json:"memory_name"`
	ScopeType     AssistantMemoryScope `json:"scope_type"`
	Kind          AssistantMemoryKind  `json:"kind"`
	Tags          []string             `json:"tags"`
	Content       string               `json:"content"`
	Priority      uint8                `json:"priority"`
	IsPinned      bool                 `json:"is_pinned"`
	SkipSupersede bool                 `json:"skip_supersede"`
}

// AssistantMemoryUpdateRequest 是一般記憶編輯 API 的完整更新內容；
// skip_supersede 只屬於草稿確認流程，不應出現在這個 DTO。
type AssistantMemoryUpdateRequest struct {
	MemoryName string               `json:"memory_name"`
	ScopeType  AssistantMemoryScope `json:"scope_type"`
	Kind       AssistantMemoryKind  `json:"kind"`
	Tags       []string             `json:"tags"`
	Content    string               `json:"content"`
	Priority   uint8                `json:"priority"`
	IsPinned   bool                 `json:"is_pinned"`
}

// AssistantMemoryUpsertRequest 給 MCP 使用；scope 必須明確指定，不能從缺少的欄位猜測。
type AssistantMemoryUpsertRequest struct {
	MemoryPublicID  string                `json:"memory_public_id"`
	ProjectPublicID string                `json:"project_public_id"`
	StoryPublicID   string                `json:"story_public_id"`
	LorePublicID    string                `json:"lore_public_id"`
	MemoryName      *string               `json:"memory_name"`
	ScopeType       *AssistantMemoryScope `json:"scope_type"`
	Kind            *AssistantMemoryKind  `json:"kind"`
	Tags            *[]string             `json:"tags"`
	Content         *string               `json:"content"`
	Priority        *uint8                `json:"priority"`
	IsPinned        *bool                 `json:"is_pinned"`
}

// AssistantMemoryDraftOutput 是非同步整理流程的輪詢結果；provider/key 與 token
// 用量只留在後端稽核，不回傳給前端。
type AssistantMemoryDraftOutput struct {
	PublicID           string                 `json:"public_id"`
	Status             AssistantMemoryStatus  `json:"status"`
	ShouldRemember     *bool                  `json:"should_remember,omitempty"`
	MemoryName         string                 `json:"memory_name,omitempty"`
	ScopeType          AssistantMemoryScope   `json:"scope_type,omitempty"`
	Kind               AssistantMemoryKind    `json:"kind,omitempty"`
	Tags               []string               `json:"tags"`
	Content            string                 `json:"content,omitempty"`
	Priority           uint8                  `json:"priority"`
	SupersedesPublicID string                 `json:"supersedes_public_id,omitempty"`
	SupersededMemory   *AssistantMemoryOutput `json:"superseded_memory,omitempty"`
	ErrorMessage       string                 `json:"error_message,omitempty"`
}
