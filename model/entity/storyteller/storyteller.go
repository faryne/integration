package storyteller

import "time"

type ProjectVisibility string

const (
	ProjectVisibilityPublic   ProjectVisibility = "public"
	ProjectVisibilityUnlisted ProjectVisibility = "unlisted"
	ProjectVisibilityPrivate  ProjectVisibility = "private"
)

type AgentProvider string

const (
	AgentProviderGrok AgentProvider = "grok"
)

type ChatMessageRole string

const (
	ChatMessageRoleSystem    ChatMessageRole = "system"
	ChatMessageRoleUser      ChatMessageRole = "user"
	ChatMessageRoleAssistant ChatMessageRole = "assistant"
)

type Project struct {
	ID          uint64            `gorm:"column:id;primaryKey" json:"id"`
	PublicID    string            `gorm:"column:public_id" json:"public_id"`
	UserID      uint64            `gorm:"column:user_id" json:"user_id"`
	Name        string            `gorm:"column:name" json:"name"`
	Slug        string            `gorm:"column:slug" json:"slug"`
	Description string            `gorm:"column:description" json:"description"`
	Visibility  ProjectVisibility `gorm:"column:visibility" json:"visibility"`
	ShareToken  string            `gorm:"column:share_token" json:"share_token"`
	DeletedAt   *time.Time        `gorm:"column:deleted_at" json:"deleted_at"`
	CreatedAt   time.Time         `gorm:"column:created_at" json:"created_at"`
	UpdatedAt   time.Time         `gorm:"column:updated_at" json:"updated_at"`
}

func (Project) TableName() string { return "storyteller_projects" }

type Agent struct {
	ID            uint64        `gorm:"column:id;primaryKey" json:"id"`
	UserID        uint64        `gorm:"column:user_id" json:"user_id"`
	Name          string        `gorm:"column:name" json:"name"`
	Provider      AgentProvider `gorm:"column:provider" json:"provider"`
	ModelName     string        `gorm:"column:model_name" json:"model_name"`
	APIKey        string        `gorm:"column:api_key" json:"-"`
	DefaultPrompt string        `gorm:"column:default_prompt" json:"default_prompt"`
	IsDeleted     bool          `gorm:"column:is_deleted" json:"is_deleted"`
	DeletedAt     *time.Time    `gorm:"column:deleted_at" json:"deleted_at"`
	CreatedAt     time.Time     `gorm:"column:created_at" json:"created_at"`
	UpdatedAt     time.Time     `gorm:"column:updated_at" json:"updated_at"`
}

func (Agent) TableName() string { return "storyteller_agents" }

type Story struct {
	ID            uint64     `gorm:"column:id;primaryKey" json:"id"`
	PublicID      string     `gorm:"column:public_id" json:"public_id"`
	ProjectID     uint64     `gorm:"column:project_id" json:"project_id"`
	Title         string     `gorm:"column:title" json:"title"`
	Summary       string     `gorm:"column:summary" json:"summary"`
	Sort          int        `gorm:"column:sort" json:"sort"`
	LatestContent string     `gorm:"column:latest_content" json:"latest_content"`
	WordCount     uint       `gorm:"column:word_count" json:"word_count"`
	DeletedAt     *time.Time `gorm:"column:deleted_at" json:"deleted_at"`
	CreatedAt     time.Time  `gorm:"column:created_at" json:"created_at"`
	UpdatedAt     time.Time  `gorm:"column:updated_at" json:"updated_at"`
}

func (Story) TableName() string { return "storyteller_stories" }

type StoryVersion struct {
	ID        uint64     `gorm:"column:id;primaryKey" json:"id"`
	StoryID   uint64     `gorm:"column:story_id" json:"story_id"`
	Title     string     `gorm:"column:title" json:"title"`
	Summary   string     `gorm:"column:summary" json:"summary"`
	Content   string     `gorm:"column:content" json:"content"`
	WordCount uint       `gorm:"column:word_count" json:"word_count"`
	DeletedAt *time.Time `gorm:"column:deleted_at" json:"deleted_at"`
	CreatedAt time.Time  `gorm:"column:created_at" json:"created_at"`
	UpdatedAt time.Time  `gorm:"column:updated_at" json:"updated_at"`
}

func (StoryVersion) TableName() string { return "storyteller_story_versions" }

type StoryChat struct {
	ID        uint64     `gorm:"column:id;primaryKey" json:"id"`
	StoryID   uint64     `gorm:"column:story_id" json:"story_id"`
	AgentID   uint64     `gorm:"column:agent_id" json:"agent_id"`
	UserID    uint64     `gorm:"column:user_id" json:"user_id"`
	Title     string     `gorm:"column:title" json:"title"`
	Metadata  string     `gorm:"column:metadata" json:"metadata"`
	DeletedAt *time.Time `gorm:"column:deleted_at" json:"deleted_at"`
	CreatedAt time.Time  `gorm:"column:created_at" json:"created_at"`
	UpdatedAt time.Time  `gorm:"column:updated_at" json:"updated_at"`
}

func (StoryChat) TableName() string { return "storyteller_story_chats" }

type StoryChatMessage struct {
	ID        uint64          `gorm:"column:id;primaryKey" json:"id"`
	ChatID    uint64          `gorm:"column:chat_id" json:"chat_id"`
	Role      ChatMessageRole `gorm:"column:role" json:"role"`
	Content   string          `gorm:"column:content" json:"content"`
	Metadata  string          `gorm:"column:metadata" json:"metadata"`
	DeletedAt *time.Time      `gorm:"column:deleted_at" json:"deleted_at"`
	CreatedAt time.Time       `gorm:"column:created_at" json:"created_at"`
	UpdatedAt time.Time       `gorm:"column:updated_at" json:"updated_at"`
}

func (StoryChatMessage) TableName() string {
	return "storyteller_story_chat_messages"
}

type ProjectRanking struct {
	ID         uint64     `gorm:"column:id;primaryKey" json:"id"`
	UserID     uint64     `gorm:"column:user_id" json:"user_id"`
	ProjectID  uint64     `gorm:"column:project_id" json:"project_id"`
	Ranking    *float64   `gorm:"column:ranking" json:"ranking"`
	IsFavorite bool       `gorm:"column:is_favorite" json:"is_favorite"`
	DeletedAt  *time.Time `gorm:"column:deleted_at" json:"deleted_at"`
	CreatedAt  time.Time  `gorm:"column:created_at" json:"created_at"`
	UpdatedAt  time.Time  `gorm:"column:updated_at" json:"updated_at"`
	Project    Project    `gorm:"foreignKey:ProjectID" json:"project"`
}

func (ProjectRanking) TableName() string {
	return "storyteller_project_rankings"
}

type ProjectRequest struct {
	Name        string            `json:"name"`
	Slug        string            `json:"slug"`
	Description string            `json:"description"`
	Visibility  ProjectVisibility `json:"visibility"`
}

type AgentRequest struct {
	Name          string        `json:"name"`
	Provider      AgentProvider `json:"provider"`
	ModelName     string        `json:"model_name"`
	APIKey        string        `json:"api_key"`
	DefaultPrompt string        `json:"default_prompt"`
}

type StoryRequest struct {
	Title   string `json:"title"`
	Summary string `json:"summary"`
	Sort    int    `json:"sort"`
	Content string `json:"content"`
}

type ProjectOutput struct {
	Project
	AverageRating float64 `gorm:"-" json:"average_rating"`
	RatingCount   uint64  `gorm:"-" json:"rating_count"`
	IsFavorite    bool    `gorm:"-" json:"is_favorite"`
	Stories       []Story `gorm:"-" json:"stories,omitempty"`
}
