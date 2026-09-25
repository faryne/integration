package storyteller

import "time"

type AssistantMemoryScope string

const (
	AssistantMemoryScopeAccount AssistantMemoryScope = "account"
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

// AssistantMemory 是梭梭保存的原子記憶。ScopeType 與三個目標 ID 的合法組合由
// service 保證；PublicID 只識別記憶本身，不代表作用域目標。
type AssistantMemory struct {
	ID             uint64               `gorm:"column:id;primaryKey" json:"-"`
	PublicID       string               `gorm:"column:public_id" json:"public_id"`
	UserID         uint64               `gorm:"column:user_id" json:"-"`
	ScopeType      AssistantMemoryScope `gorm:"column:scope_type" json:"scope_type"`
	ProjectID      *uint64              `gorm:"column:project_id" json:"-"`
	StoryID        *uint64              `gorm:"column:story_id" json:"-"`
	LoreID         *uint64              `gorm:"column:lore_id" json:"-"`
	Kind           AssistantMemoryKind  `gorm:"column:kind" json:"kind"`
	Content        string               `gorm:"column:content" json:"content"`
	Priority       uint8                `gorm:"column:priority" json:"priority"`
	IsPinned       bool                 `gorm:"column:is_pinned" json:"is_pinned"`
	SupersededByID *uint64              `gorm:"column:superseded_by_id" json:"-"`
	IsDeleted      bool                 `gorm:"column:is_deleted" json:"-"`
	DeletedAt      *time.Time           `gorm:"column:deleted_at" json:"-"`
	CreatedAt      time.Time            `gorm:"column:created_at" json:"created_at"`
	UpdatedAt      time.Time            `gorm:"column:updated_at" json:"updated_at"`
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
// project、story 或 lore，account scope 則留空。
type AssistantMemoryOutput struct {
	PublicID       string               `json:"public_id"`
	ScopeType      AssistantMemoryScope `json:"scope_type"`
	TargetPublicID string               `json:"target_public_id,omitempty"`
	Kind           AssistantMemoryKind  `json:"kind"`
	Content        string               `json:"content"`
	Priority       uint8                `json:"priority"`
	IsPinned       bool                 `json:"is_pinned"`
	CreatedAt      time.Time            `json:"created_at"`
	UpdatedAt      time.Time            `json:"updated_at"`
}
