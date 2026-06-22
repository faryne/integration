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
	DeletedAt *time.Time `gorm:"column:deleted_at" json:"deleted_at"`
	CreatedAt time.Time  `gorm:"column:created_at" json:"created_at"`
	UpdatedAt time.Time  `gorm:"column:updated_at" json:"updated_at"`
}

func (StoryVersion) TableName() string { return "storyteller_story_versions" }
