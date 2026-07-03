package storyteller

import "time"

type ProjectVisibility string

const (
	ProjectVisibilityPublic   ProjectVisibility = "public"
	ProjectVisibilityUnlisted ProjectVisibility = "unlisted"
	ProjectVisibilityPrivate  ProjectVisibility = "private"
)

type ProjectRating string

const (
	ProjectRatingGeneral    ProjectRating = "general"
	ProjectRatingGuidance   ProjectRating = "guidance"
	ProjectRatingRestricted ProjectRating = "restricted"
)

type StoryStatus string

const (
	StoryStatusDraft     StoryStatus = "draft"
	StoryStatusCompleted StoryStatus = "completed"
)

type AgentProvider string

const (
	AgentProviderGrok       AgentProvider = "grok"
	AgentProviderOpenAI     AgentProvider = "openai"
	AgentProviderClaude     AgentProvider = "claude"
	AgentProviderGemini     AgentProvider = "gemini"
	AgentProviderOpenRouter AgentProvider = "openrouter"
)

type AgentModelOption struct {
	ID          uint64 `json:"id"`
	Name        string `json:"name"`
	Label       string `json:"label"`
	Description string `json:"description"`
	Price       string `json:"price"`
}

type AgentModelSyncInput struct {
	Name        string
	Label       string
	Description string
	Price       string
	Sort        int
}

type AgentProviderModels struct {
	Provider         AgentProvider      `json:"provider"`
	Label            string             `json:"label"`
	Models           []AgentModelOption `json:"models"`
	AllowCustomModel bool               `json:"allow_custom_model"`
}

type AgentRunMode string

const (
	AgentRunModeRewriteSelection   AgentRunMode = "rewrite_selection"
	AgentRunModeExpandSelection    AgentRunMode = "expand_selection"
	AgentRunModeTranslateSelection AgentRunMode = "translate_selection"
	AgentRunModeContinueChapter    AgentRunMode = "continue_chapter"
	AgentRunModeCustomSelection    AgentRunMode = "custom_selection"
	AgentRunModeCustomChapter      AgentRunMode = "custom_chapter"
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
	Rating      ProjectRating     `gorm:"column:rating" json:"rating"`
	Tags        string            `gorm:"column:tags" json:"-"`
	ShareToken  string            `gorm:"column:share_token" json:"share_token"`
	DeletedAt   *time.Time        `gorm:"column:deleted_at" json:"deleted_at"`
	CreatedAt   time.Time         `gorm:"column:created_at" json:"created_at"`
	UpdatedAt   time.Time         `gorm:"column:updated_at" json:"updated_at"`
}

func (Project) TableName() string { return "storyteller_projects" }

type Agent struct {
	ID               uint64        `gorm:"column:id;primaryKey" json:"id"`
	UserID           uint64        `gorm:"column:user_id" json:"user_id"`
	Name             string        `gorm:"column:name" json:"name"`
	Provider         AgentProvider `gorm:"column:provider" json:"provider"`
	ModelName        string        `gorm:"column:model_name" json:"model_name"`
	AgentModelID     *uint64       `gorm:"column:agent_model_id" json:"agent_model_id"`
	ProviderAPIKeyID *uint64       `gorm:"column:provider_apikey_id" json:"provider_apikey_id"`
	DefaultPrompt    string        `gorm:"column:default_prompt" json:"default_prompt"`
	IsDeleted        bool          `gorm:"column:is_deleted" json:"is_deleted"`
	DeletedAt        *time.Time    `gorm:"column:deleted_at" json:"deleted_at"`
	CreatedAt        time.Time     `gorm:"column:created_at" json:"created_at"`
	UpdatedAt        time.Time     `gorm:"column:updated_at" json:"updated_at"`
}

func (Agent) TableName() string { return "storyteller_agents" }

type ProviderAPIKey struct {
	ID              uint64        `gorm:"column:id;primaryKey" json:"id"`
	UserID          uint64        `gorm:"column:user_id" json:"user_id"`
	Provider        AgentProvider `gorm:"column:provider" json:"provider"`
	Label           string        `gorm:"column:label" json:"label"`
	APIKey          string        `gorm:"column:api_key" json:"-"`
	APIKeyEncrypted string        `gorm:"column:api_key_encrypted" json:"-"`
	APIKeyDataKey   string        `gorm:"column:api_key_data_key" json:"-"`
	APIKeyKeyID     string        `gorm:"column:api_key_key_id" json:"-"`
	IsDeleted       bool          `gorm:"column:is_deleted" json:"is_deleted"`
	DeletedAt       *time.Time    `gorm:"column:deleted_at" json:"deleted_at"`
	CreatedAt       time.Time     `gorm:"column:created_at" json:"created_at"`
	UpdatedAt       time.Time     `gorm:"column:updated_at" json:"updated_at"`
}

func (ProviderAPIKey) TableName() string { return "storyteller_provider_apikeys" }

type AgentProviderSetting struct {
	ID               uint64        `gorm:"column:id;primaryKey" json:"id"`
	Provider         AgentProvider `gorm:"column:provider" json:"provider"`
	Label            string        `gorm:"column:label" json:"label"`
	AllowCustomModel bool          `gorm:"column:allow_custom_model" json:"allow_custom_model"`
	Sort             int           `gorm:"column:sort" json:"sort"`
	IsDeleted        bool          `gorm:"column:is_deleted" json:"is_deleted"`
	DeletedAt        *time.Time    `gorm:"column:deleted_at" json:"deleted_at"`
	CreatedAt        time.Time     `gorm:"column:created_at" json:"created_at"`
	UpdatedAt        time.Time     `gorm:"column:updated_at" json:"updated_at"`
}

func (AgentProviderSetting) TableName() string {
	return "storyteller_agent_providers"
}

type AgentModel struct {
	ID          uint64     `gorm:"column:id;primaryKey" json:"id"`
	ProviderID  uint64     `gorm:"column:provider_id" json:"provider_id"`
	Name        string     `gorm:"column:name" json:"name"`
	Label       string     `gorm:"column:label" json:"label"`
	Description string     `gorm:"column:description" json:"description"`
	Price       string     `gorm:"column:price" json:"price"`
	Sort        int        `gorm:"column:sort" json:"sort"`
	IsDeleted   bool       `gorm:"column:is_deleted" json:"is_deleted"`
	DeletedAt   *time.Time `gorm:"column:deleted_at" json:"deleted_at"`
	CreatedAt   time.Time  `gorm:"column:created_at" json:"created_at"`
	UpdatedAt   time.Time  `gorm:"column:updated_at" json:"updated_at"`
}

func (AgentModel) TableName() string {
	return "storyteller_agent_models"
}

type AgentPromptVersion struct {
	ID            uint64        `gorm:"column:id;primaryKey" json:"id"`
	AgentID       uint64        `gorm:"column:agent_id" json:"agent_id"`
	Name          string        `gorm:"column:name" json:"name"`
	Provider      AgentProvider `gorm:"column:provider" json:"provider"`
	ModelName     string        `gorm:"column:model_name" json:"model_name"`
	DefaultPrompt string        `gorm:"column:default_prompt" json:"default_prompt"`
	DeletedAt     *time.Time    `gorm:"column:deleted_at" json:"deleted_at"`
	CreatedAt     time.Time     `gorm:"column:created_at" json:"created_at"`
	UpdatedAt     time.Time     `gorm:"column:updated_at" json:"updated_at"`
}

func (AgentPromptVersion) TableName() string {
	return "storyteller_agent_prompt_versions"
}

type Story struct {
	ID            uint64      `gorm:"column:id;primaryKey" json:"id"`
	PublicID      string      `gorm:"column:public_id" json:"public_id"`
	ProjectID     uint64      `gorm:"column:project_id" json:"project_id"`
	Title         string      `gorm:"column:title" json:"title"`
	Summary       string      `gorm:"column:summary" json:"summary"`
	Status        StoryStatus `gorm:"column:status" json:"status"`
	Sort          int         `gorm:"column:sort" json:"sort"`
	LatestContent string      `gorm:"column:latest_content" json:"latest_content"`
	WordCount     uint        `gorm:"column:word_count" json:"word_count"`
	IsDeleted     bool        `gorm:"column:is_deleted" json:"is_deleted"`
	DeletedAt     *time.Time  `gorm:"column:deleted_at" json:"deleted_at"`
	CreatedAt     time.Time   `gorm:"column:created_at" json:"created_at"`
	UpdatedAt     time.Time   `gorm:"column:updated_at" json:"updated_at"`
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

type Lore struct {
	ID            uint64     `gorm:"column:id;primaryKey" json:"id"`
	PublicID      string     `gorm:"column:public_id" json:"public_id"`
	ProjectID     uint64     `gorm:"column:project_id" json:"project_id"`
	Title         string     `gorm:"column:title" json:"title"`
	LatestContent string     `gorm:"column:latest_content" json:"latest_content"`
	WordCount     uint       `gorm:"column:word_count" json:"word_count"`
	IsDeleted     bool       `gorm:"column:is_deleted" json:"is_deleted"`
	DeletedAt     *time.Time `gorm:"column:deleted_at" json:"deleted_at"`
	CreatedAt     time.Time  `gorm:"column:created_at" json:"created_at"`
	UpdatedAt     time.Time  `gorm:"column:updated_at" json:"updated_at"`
}

func (Lore) TableName() string { return "storyteller_lores" }

type LoreVersion struct {
	ID        uint64     `gorm:"column:id;primaryKey" json:"id"`
	LoreID    uint64     `gorm:"column:lore_id" json:"lore_id"`
	Title     string     `gorm:"column:title" json:"title"`
	Content   string     `gorm:"column:content" json:"content"`
	WordCount uint       `gorm:"column:word_count" json:"word_count"`
	DeletedAt *time.Time `gorm:"column:deleted_at" json:"deleted_at"`
	CreatedAt time.Time  `gorm:"column:created_at" json:"created_at"`
	UpdatedAt time.Time  `gorm:"column:updated_at" json:"updated_at"`
}

func (LoreVersion) TableName() string { return "storyteller_lore_versions" }

type StoryChat struct {
	ID        uint64    `gorm:"column:id;primaryKey" json:"id"`
	StoryID   *uint64   `gorm:"column:story_id" json:"story_id"`
	LoreID    *uint64   `gorm:"column:lore_id" json:"lore_id"`
	AgentID   uint64    `gorm:"column:agent_id" json:"agent_id"`
	UserID    uint64    `gorm:"column:user_id" json:"user_id"`
	CreatedAt time.Time `gorm:"column:created_at" json:"created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at" json:"updated_at"`
}

func (StoryChat) TableName() string { return "storyteller_story_chats" }

type StoryChatMessage struct {
	ID        uint64          `gorm:"column:id;primaryKey" json:"id"`
	ChatID    uint64          `gorm:"column:chat_id" json:"chat_id"`
	AgentID   *uint64         `gorm:"column:agent_id" json:"agent_id"`
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

type AuthorFavorite struct {
	ID           uint64     `gorm:"column:id;primaryKey" json:"id"`
	UserID       uint64     `gorm:"column:user_id" json:"user_id"`
	AuthorUserID uint64     `gorm:"column:author_user_id" json:"author_user_id"`
	DeletedAt    *time.Time `gorm:"column:deleted_at" json:"deleted_at"`
	CreatedAt    time.Time  `gorm:"column:created_at" json:"created_at"`
	UpdatedAt    time.Time  `gorm:"column:updated_at" json:"updated_at"`
}

func (AuthorFavorite) TableName() string {
	return "storyteller_author_favorites"
}

type UserProfile struct {
	ID               uint64     `gorm:"column:id;primaryKey" json:"id"`
	UserID           uint64     `gorm:"column:user_id" json:"user_id"`
	PenName          string     `gorm:"column:pen_name" json:"pen_name"`
	Bio              string     `gorm:"column:bio" json:"bio"`
	UseDefaultAvatar bool       `gorm:"column:use_default_avatar" json:"use_default_avatar"`
	AvatarURL        string     `gorm:"column:avatar_url" json:"avatar_url"`
	DeletedAt        *time.Time `gorm:"column:deleted_at" json:"deleted_at"`
	CreatedAt        time.Time  `gorm:"column:created_at" json:"created_at"`
	UpdatedAt        time.Time  `gorm:"column:updated_at" json:"updated_at"`
}

func (UserProfile) TableName() string {
	return "storyteller_users"
}

type ProjectRequest struct {
	Name        string            `json:"name"`
	Slug        string            `json:"slug"`
	Description string            `json:"description"`
	Visibility  ProjectVisibility `json:"visibility"`
	Rating      ProjectRating     `json:"rating"`
	Tags        []string          `json:"tags"`
}

type AgentRequest struct {
	Name             string        `json:"name"`
	Provider         AgentProvider `json:"provider"`
	ModelName        string        `json:"model_name"`
	ProviderAPIKeyID *uint64       `json:"provider_apikey_id"`
	DefaultPrompt    string        `json:"default_prompt"`
}

type AgentRunRequest struct {
	Mode             AgentRunMode `json:"mode"`
	Instruction      string       `json:"instruction"`
	FullContent      string       `json:"full_content"`
	SelectedContent  string       `json:"selected_content"`
	SelectionStart   *int         `json:"selection_start"`
	SelectionEnd     *int         `json:"selection_end"`
	ProviderAPIKeyID *uint64      `json:"provider_apikey_id,omitempty"`
}

type ProviderAPIKeyRequest struct {
	Provider AgentProvider `json:"provider"`
	Label    string        `json:"label"`
	APIKey   string        `json:"api_key"`
}

type ProviderAPIKeyOutput struct {
	ID        uint64        `json:"id"`
	Provider  AgentProvider `json:"provider"`
	Label     string        `json:"label"`
	CreatedAt time.Time     `json:"created_at"`
	UpdatedAt time.Time     `json:"updated_at"`
}

type StoryRequest struct {
	Title   string      `json:"title"`
	Summary string      `json:"summary"`
	Status  StoryStatus `json:"status"`
	Sort    int         `json:"sort"`
	Content string      `json:"content"`
}

type LoreRequest struct {
	Title   string `json:"title"`
	Content string `json:"content"`
}

type ProjectRankingRequest struct {
	Ranking float64 `json:"ranking"`
}

type UserProfileRequest struct {
	PenName          string `json:"pen_name"`
	Bio              string `json:"bio"`
	UseDefaultAvatar bool   `json:"use_default_avatar"`
	AvatarURL        string `json:"avatar_url"`
}

type ProjectRankingOutput struct {
	Ranking *float64 `json:"ranking"`
}

type AgentRunUsage struct {
	InputTokens  int `json:"input_tokens,omitempty"`
	OutputTokens int `json:"output_tokens,omitempty"`
	TotalTokens  int `json:"total_tokens,omitempty"`
}

type AgentRunResponse struct {
	AgentID      uint64         `json:"agent_id"`
	Provider     AgentProvider  `json:"provider"`
	ModelName    string         `json:"model_name"`
	Mode         AgentRunMode   `json:"mode"`
	Result       string         `json:"result"`
	Usage        *AgentRunUsage `json:"usage,omitempty"`
	FinishReason string         `json:"finish_reason,omitempty"`
}

type StoryChatMessageOutput struct {
	ID        uint64          `json:"id"`
	ChatID    uint64          `json:"chat_id"`
	Role      ChatMessageRole `json:"role"`
	Content   string          `json:"content"`
	Metadata  string          `json:"metadata,omitempty"`
	AgentID   uint64          `gorm:"column:agent_id" json:"agent_id"`
	AgentName string          `json:"agent_name"`
	CreatedAt time.Time       `json:"created_at"`
	UpdatedAt time.Time       `json:"updated_at"`
}

type UserProfileOutput struct {
	UserID           uint64 `json:"user_id"`
	PenName          string `json:"pen_name"`
	Bio              string `json:"bio,omitempty"`
	UseDefaultAvatar bool   `json:"use_default_avatar"`
	AvatarURL        string `json:"avatar_url,omitempty"`
}

type FavoriteAuthorOutput struct {
	UserProfileOutput
	ProjectCount  uint64  `json:"project_count"`
	StoryCount    uint64  `json:"story_count"`
	WordCount     uint64  `json:"word_count"`
	RatingCount   uint64  `json:"rating_count"`
	AverageRating float64 `json:"average_rating"`
}

type ProjectOutput struct {
	Project
	AverageRating float64            `gorm:"-" json:"average_rating"`
	RatingCount   uint64             `gorm:"-" json:"rating_count"`
	IsFavorite    bool               `gorm:"-" json:"is_favorite"`
	TagList       []string           `gorm:"-" json:"tags"`
	Stories       []Story            `gorm:"-" json:"stories,omitempty"`
	Author        *UserProfileOutput `gorm:"-" json:"author,omitempty"`
}
