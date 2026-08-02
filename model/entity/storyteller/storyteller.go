package storyteller

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

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

// ProjectContentType 只是專案預設顯示 layout 的偏好，可隨時修改；不限制專案底下
// 的故事／冊只能是單一類型，同一個專案未來可以同時有文字故事與圖像作品（詳見
// DevelopDocuments/storyteller/漫畫插圖閱讀器.md）。
type ProjectContentType string

const (
	ProjectContentTypeText  ProjectContentType = "text"
	ProjectContentTypeImage ProjectContentType = "image"
)

type AssetType string

const (
	AssetTypeImage AssetType = "image"
	AssetTypeAudio AssetType = "audio"
	AssetTypeVideo AssetType = "video"
)

type SNSType string

const (
	SNSTypeX         SNSType = "x"
	SNSTypeFacebook  SNSType = "facebook"
	SNSTypeInstagram SNSType = "instagram"
	SNSTypeThreads   SNSType = "threads"
	SNSTypeWebsite   SNSType = "website"
	SNSTypePlurk     SNSType = "plurk"
	SNSTypeBahamut   SNSType = "bahamut"
	SNSTypeDiscord   SNSType = "discord"
	SNSTypeYouTube   SNSType = "youtube"
)

// SNSLinks maps an SNSType (or a user-supplied custom label) to its URI.
type SNSLinks map[string]string

func (l SNSLinks) Value() (driver.Value, error) {
	if l == nil {
		return nil, nil
	}
	data, err := json.Marshal(l)
	if err != nil {
		return nil, err
	}
	return data, nil
}

func (l *SNSLinks) Scan(value any) error {
	if value == nil {
		*l = nil
		return nil
	}
	var data []byte
	switch v := value.(type) {
	case []byte:
		data = v
	case string:
		data = []byte(v)
	default:
		return fmt.Errorf("cannot scan %T into SNSLinks", value)
	}
	if len(data) == 0 {
		*l = nil
		return nil
	}
	return json.Unmarshal(data, l)
}

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
	AgentProviderSelfHosted AgentProvider = "self_hosted"
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
	ID          uint64             `gorm:"column:id;primaryKey" json:"id"`
	PublicID    string             `gorm:"column:public_id" json:"public_id"`
	UserID      uint64             `gorm:"column:user_id" json:"user_id"`
	Name        string             `gorm:"column:name" json:"name"`
	Slug        string             `gorm:"column:slug" json:"slug"`
	Description string             `gorm:"column:description" json:"description"`
	Visibility  ProjectVisibility  `gorm:"column:visibility" json:"visibility"`
	Rating      ProjectRating      `gorm:"column:rating" json:"rating"`
	ContentType ProjectContentType `gorm:"column:content_type" json:"content_type"`
	Tags        string             `gorm:"column:tags" json:"-"`
	ShareToken  string             `gorm:"column:share_token" json:"share_token"`
	DeletedAt   *time.Time         `gorm:"column:deleted_at" json:"deleted_at"`
	CreatedAt   time.Time          `gorm:"column:created_at" json:"created_at"`
	UpdatedAt   time.Time          `gorm:"column:updated_at" json:"updated_at"`
}

func (Project) TableName() string { return "storyteller_projects" }

// AssetMetadata 存媒體類型各自不同的補充資訊。第一版 image 會寫入 width/height；
// 未來 audio/video 可以加 duration_seconds、codec 等，不需要一直替 assets 表加 nullable 欄位。
type AssetMetadata map[string]any

func (m AssetMetadata) Value() (driver.Value, error) {
	if m == nil {
		return nil, nil
	}
	data, err := json.Marshal(m)
	if err != nil {
		return nil, err
	}
	return data, nil
}

func (m *AssetMetadata) Scan(value any) error {
	if value == nil {
		*m = nil
		return nil
	}
	var data []byte
	switch v := value.(type) {
	case []byte:
		data = v
	case string:
		data = []byte(v)
	default:
		return fmt.Errorf("cannot scan %T into AssetMetadata", value)
	}
	if len(data) == 0 {
		*m = nil
		return nil
	}
	return json.Unmarshal(data, m)
}

type Asset struct {
	ID               uint64        `gorm:"column:id;primaryKey" json:"id"`
	PublicID         string        `gorm:"column:public_id" json:"public_id"`
	UserID           uint64        `gorm:"column:user_id" json:"user_id"`
	ProjectID        uint64        `gorm:"column:project_id" json:"project_id"`
	CollectionID     *uint64       `gorm:"column:collection_id" json:"collection_id"`
	AssetType        AssetType     `gorm:"column:asset_type" json:"asset_type"`
	MimeType         string        `gorm:"column:mime_type" json:"mime_type"`
	FileExt          string        `gorm:"column:file_ext" json:"file_ext"`
	FileSize         uint64        `gorm:"column:file_size" json:"file_size"`
	Metadata         AssetMetadata `gorm:"column:metadata;type:json" json:"metadata"`
	S3Key            string        `gorm:"column:s3_key" json:"-"`
	OriginalFilename string        `gorm:"column:original_filename" json:"original_filename"`
	Title            string        `gorm:"column:title" json:"title"`
	AltText          string        `gorm:"column:alt_text" json:"alt_text"`
	Description      string        `gorm:"column:description" json:"description"`
	IsDeleted        bool          `gorm:"column:is_deleted" json:"-"`
	DeletedAt        *time.Time    `gorm:"column:deleted_at" json:"-"`
	CreatedAt        time.Time     `gorm:"column:created_at" json:"created_at"`
	UpdatedAt        time.Time     `gorm:"column:updated_at" json:"updated_at"`
}

func (Asset) TableName() string { return "storyteller_assets" }

type AssetCollection struct {
	ID        uint64     `gorm:"column:id;primaryKey" json:"id"`
	PublicID  string     `gorm:"column:public_id" json:"public_id"`
	ProjectID uint64     `gorm:"column:project_id" json:"project_id"`
	Name      string     `gorm:"column:name" json:"name"`
	Sort      int        `gorm:"column:sort" json:"sort"`
	IsDeleted bool       `gorm:"column:is_deleted" json:"-"`
	DeletedAt *time.Time `gorm:"column:deleted_at" json:"-"`
	CreatedAt time.Time  `gorm:"column:created_at" json:"created_at"`
	UpdatedAt time.Time  `gorm:"column:updated_at" json:"updated_at"`
}

func (AssetCollection) TableName() string { return "storyteller_asset_collections" }

type AssetReference struct {
	ID              uint64    `gorm:"column:id;primaryKey" json:"id"`
	AssetID         uint64    `gorm:"column:asset_id" json:"asset_id"`
	TargetType      string    `gorm:"column:target_type" json:"target_type"`
	TargetID        uint64    `gorm:"column:target_id" json:"target_id"`
	TargetVersionID *uint64   `gorm:"column:target_version_id" json:"target_version_id"`
	ReferenceKey    string    `gorm:"column:reference_key" json:"reference_key"`
	CreatedAt       time.Time `gorm:"column:created_at" json:"created_at"`
	UpdatedAt       time.Time `gorm:"column:updated_at" json:"updated_at"`
}

func (AssetReference) TableName() string { return "storyteller_asset_references" }

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
	Endpoint        string        `gorm:"column:endpoint" json:"endpoint"`
	APIKeyEncrypted string        `gorm:"column:api_key_encrypted" json:"-"`
	APIKeyDataKey   string        `gorm:"column:api_key_data_key" json:"-"`
	APIKeyKeyID     string        `gorm:"column:api_key_key_id" json:"-"`
	LastTestedAt    *time.Time    `gorm:"column:last_tested_at" json:"last_tested_at"`
	LastTestOK      *bool         `gorm:"column:last_test_ok" json:"last_test_ok"`
	IsDeleted       bool          `gorm:"column:is_deleted" json:"is_deleted"`
	DeletedAt       *time.Time    `gorm:"column:deleted_at" json:"deleted_at"`
	CreatedAt       time.Time     `gorm:"column:created_at" json:"created_at"`
	UpdatedAt       time.Time     `gorm:"column:updated_at" json:"updated_at"`
}

func (ProviderAPIKey) TableName() string { return "storyteller_provider_apikeys" }

// AgentUsageLog 記錄每一次 Agent 執行實際使用的 API Key 與 token 用量，
// provider/model_name 是執行當下的快照，不會隨著 Agent 或 Key 之後的設定變更而改變。
type AgentUsageLog struct {
	ID               uint64        `gorm:"column:id;primaryKey" json:"id"`
	UserID           uint64        `gorm:"column:user_id" json:"user_id"`
	ProviderAPIKeyID uint64        `gorm:"column:provider_apikey_id" json:"provider_apikey_id"`
	AgentID          uint64        `gorm:"column:agent_id" json:"agent_id"`
	ChatID           uint64        `gorm:"column:chat_id" json:"chat_id"`
	Provider         AgentProvider `gorm:"column:provider" json:"provider"`
	ModelName        string        `gorm:"column:model_name" json:"model_name"`
	InputTokens      int           `gorm:"column:input_tokens" json:"input_tokens"`
	OutputTokens     int           `gorm:"column:output_tokens" json:"output_tokens"`
	TotalTokens      int           `gorm:"column:total_tokens" json:"total_tokens"`
	CreatedAt        time.Time     `gorm:"column:created_at" json:"created_at"`
}

func (AgentUsageLog) TableName() string { return "storyteller_agent_usage_logs" }

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
	ID        uint64 `gorm:"column:id;primaryKey" json:"id"`
	PublicID  string `gorm:"column:public_id" json:"public_id"`
	ProjectID uint64 `gorm:"column:project_id" json:"project_id"`
	// ParentID：所屬冊（另一筆 is_volume=true 的 Story）的 id，NULL 代表未分冊或本身就是一冊。
	ParentID *uint64 `gorm:"column:parent_id" json:"parent_id"`
	// IsVolume：是否為冊——只有標題、不使用內容欄位的容器故事，不能巢狀（IsVolume=true 時 ParentID 必為 nil）。
	IsVolume bool `gorm:"column:is_volume" json:"is_volume"`
	// ContentType：text=一般文字故事，LatestContent 是 markdown；image=圖像作品（「話」），
	// LatestContent 是 JSON（見 StoryImageContent），不能用 wordCount 之類的文字邏輯處理。
	// 建立時決定，UpdateStory／UpdateVolume 都不可變更——跟 Project.ContentType 是不同層級的欄位，不要混用。
	ContentType     ProjectContentType `gorm:"column:content_type" json:"content_type"`
	Title           string             `gorm:"column:title" json:"title"`
	Summary         string             `gorm:"column:summary" json:"summary"`
	Status          StoryStatus        `gorm:"column:status" json:"status"`
	Sort            int                `gorm:"column:sort" json:"sort"`
	LatestContent   string             `gorm:"column:latest_content" json:"latest_content"`
	LatestVersionID *uint64            `gorm:"column:latest_version_id" json:"latest_version_id"`
	WordCount       uint               `gorm:"column:word_count" json:"word_count"`
	IsDeleted       bool               `gorm:"column:is_deleted" json:"is_deleted"`
	DeletedAt       *time.Time         `gorm:"column:deleted_at" json:"deleted_at"`
	CreatedAt       time.Time          `gorm:"column:created_at" json:"created_at"`
	UpdatedAt       time.Time          `gorm:"column:updated_at" json:"updated_at"`
}

func (Story) TableName() string { return "storyteller_stories" }

// StoryVolumeEvent 記錄故事的冊隸屬關係異動（新增到某冊、搬到另一冊、移出冊、
// 故事在某冊裡被刪除），FromVolumeID／ToVolumeID 皆可為 nil 代表「沒有冊」。
// 查詢一冊的異動時間軸用 `WHERE from_volume_id = :id OR to_volume_id = :id`，
// 同一筆紀錄會同時出現在來源冊跟目標冊的時間軸裡。
type StoryVolumeEvent struct {
	ID           uint64    `gorm:"column:id;primaryKey" json:"id"`
	StoryID      uint64    `gorm:"column:story_id" json:"story_id"`
	FromVolumeID *uint64   `gorm:"column:from_volume_id" json:"from_volume_id"`
	ToVolumeID   *uint64   `gorm:"column:to_volume_id" json:"to_volume_id"`
	CreatedAt    time.Time `gorm:"column:created_at" json:"created_at"`
}

func (StoryVolumeEvent) TableName() string { return "storyteller_story_volume_events" }

// StoryVolumeEventOutput 附上故事標題，供冊活動歷史畫面顯示使用，不用另外查一次故事列表比對。
type StoryVolumeEventOutput struct {
	ID            uint64    `gorm:"column:id" json:"id"`
	StoryID       uint64    `gorm:"column:story_id" json:"story_id"`
	StoryPublicID string    `gorm:"column:story_public_id" json:"story_public_id"`
	StoryTitle    string    `gorm:"column:story_title" json:"story_title"`
	FromVolumeID  *uint64   `gorm:"column:from_volume_id" json:"from_volume_id"`
	ToVolumeID    *uint64   `gorm:"column:to_volume_id" json:"to_volume_id"`
	CreatedAt     time.Time `gorm:"column:created_at" json:"created_at"`
}

// StoryVolumeActivity 是一冊的活動歷史：Events 是冊隸屬關係異動（新增/搬移/移出/刪除），
// Versions 是衍生查詢——底下故事（依目前 parent_id）存檔產生的版本記錄。
type StoryVolumeActivity struct {
	Events   []StoryVolumeEventOutput `json:"events"`
	Versions []StoryVersion           `json:"versions"`
}

type StoryVersion struct {
	ID      uint64 `gorm:"column:id;primaryKey" json:"id"`
	StoryID uint64 `gorm:"column:story_id" json:"story_id"`
	Title   string `gorm:"column:title" json:"title"`
	Summary string `gorm:"column:summary" json:"summary"`
	Content string `gorm:"column:content" json:"content"`
	Source  string `gorm:"column:source" json:"source"`
	// RevertedFromVersionID：這個版本是使用者「回復到某個舊版本」產生的，記錄回復的來源版本。
	RevertedFromVersionID *uint64 `gorm:"column:reverted_from_version_id" json:"reverted_from_version_id"`
	// ConflictedWithVersionID：存檔當下 base_version_id 已經不是最新版本，記錄當時真正
	// 最新的那個版本，讓編輯歷史事後也能看出這個版本是不是蓋在衝突上，不只依賴當次回應。
	ConflictedWithVersionID *uint64    `gorm:"column:conflicted_with_version_id" json:"conflicted_with_version_id"`
	WordCount               uint       `gorm:"column:word_count" json:"word_count"`
	DeletedAt               *time.Time `gorm:"column:deleted_at" json:"deleted_at"`
	CreatedAt               time.Time  `gorm:"column:created_at" json:"created_at"`
	UpdatedAt               time.Time  `gorm:"column:updated_at" json:"updated_at"`
}

func (StoryVersion) TableName() string { return "storyteller_story_versions" }

// StoryBookmark 同時承載文字書籤（逐行）與圖片書籤（逐頁）：LineID 對文字故事是行號的
// 字串形式（"0"、"12"...），對圖片故事是 StoryImagePage.ID。StoryVersionID 只有文字書籤
// 會填——文字內容逐版本可能不同，line_id 指到的行要綁定特定版本才能判斷是否過期；
// 圖片頁面 id 本身穩定、不隨版本變動，圖片書籤故意留 NULL，不受版本更新影響。
type StoryBookmark struct {
	ID             uint64    `gorm:"column:id;primaryKey" json:"id"`
	UserID         uint64    `gorm:"column:user_id" json:"user_id"`
	StoryID        uint64    `gorm:"column:story_id" json:"story_id"`
	StoryVersionID *uint64   `gorm:"column:story_version_id" json:"story_version_id,omitempty"`
	LineID         string    `gorm:"column:line_id" json:"line_id"`
	CreatedAt      time.Time `gorm:"column:created_at" json:"created_at"`
	UpdatedAt      time.Time `gorm:"column:updated_at" json:"updated_at"`
}

func (StoryBookmark) TableName() string { return "storyteller_story_bookmarks" }

// StoryBookmarkOutput 附上所屬章節的 public_id／標題／內容類型，供讀者頁側欄書籤列表
// 跨章節顯示與產生跳轉連結使用。LatestStoryVersionID／LinePreview 只對文字書籤有意義
// （文字書籤才綁 story_version_id，用來比對是否已經過期）；PageSort／ThumbnailURL 只對
// 圖片書籤有意義，兩者都需要解析 LatestContent 的 JSON 才能算出來，SQL 查不到，由
// service 層依 ContentType 分開填入。
type StoryBookmarkOutput struct {
	ID                   uint64             `gorm:"column:id" json:"id"`
	StoryID              uint64             `gorm:"column:story_id" json:"story_id"`
	StoryPublicID        string             `gorm:"column:story_public_id" json:"story_public_id"`
	StoryTitle           string             `gorm:"column:story_title" json:"story_title"`
	ContentType          ProjectContentType `gorm:"column:content_type" json:"content_type"`
	StoryVersionID       *uint64            `gorm:"column:story_version_id" json:"story_version_id,omitempty"`
	LatestStoryVersionID uint64             `gorm:"column:latest_story_version_id" json:"latest_story_version_id,omitempty"`
	LineID               string             `gorm:"column:line_id" json:"line_id"`
	LinePreview          string             `gorm:"column:line_preview" json:"line_preview,omitempty"`
	// PageSort 不能加 omitempty——第一頁的排序值就是 0，omitempty 會把這個合法值
	// 誤判成「空值」整欄從 JSON 消失，前端讀到 undefined 後 (page_sort ?? -1) < 0
	// 就會把第一頁的書籤誤判成「頁面已被刪除」。
	PageSort     int       `gorm:"-" json:"page_sort"`
	ThumbnailURL string    `gorm:"-" json:"thumbnail_url,omitempty"`
	CreatedAt    time.Time `gorm:"column:created_at" json:"created_at"`
}

type Lore struct {
	ID              uint64     `gorm:"column:id;primaryKey" json:"id"`
	PublicID        string     `gorm:"column:public_id" json:"public_id"`
	ProjectID       uint64     `gorm:"column:project_id" json:"project_id"`
	Title           string     `gorm:"column:title" json:"title"`
	LatestContent   string     `gorm:"column:latest_content" json:"latest_content"`
	LatestVersionID *uint64    `gorm:"column:latest_version_id" json:"latest_version_id"`
	WordCount       uint       `gorm:"column:word_count" json:"word_count"`
	IsDeleted       bool       `gorm:"column:is_deleted" json:"is_deleted"`
	DeletedAt       *time.Time `gorm:"column:deleted_at" json:"deleted_at"`
	CreatedAt       time.Time  `gorm:"column:created_at" json:"created_at"`
	UpdatedAt       time.Time  `gorm:"column:updated_at" json:"updated_at"`
}

func (Lore) TableName() string { return "storyteller_lores" }

// LoreVersion 的 RevertedFromVersionID／ConflictedWithVersionID 語意跟 StoryVersion 一樣。
type LoreVersion struct {
	ID                      uint64     `gorm:"column:id;primaryKey" json:"id"`
	LoreID                  uint64     `gorm:"column:lore_id" json:"lore_id"`
	Title                   string     `gorm:"column:title" json:"title"`
	Content                 string     `gorm:"column:content" json:"content"`
	Source                  string     `gorm:"column:source" json:"source"`
	RevertedFromVersionID   *uint64    `gorm:"column:reverted_from_version_id" json:"reverted_from_version_id"`
	ConflictedWithVersionID *uint64    `gorm:"column:conflicted_with_version_id" json:"conflicted_with_version_id"`
	WordCount               uint       `gorm:"column:word_count" json:"word_count"`
	DeletedAt               *time.Time `gorm:"column:deleted_at" json:"deleted_at"`
	CreatedAt               time.Time  `gorm:"column:created_at" json:"created_at"`
	UpdatedAt               time.Time  `gorm:"column:updated_at" json:"updated_at"`
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
	ID             uint64     `gorm:"column:id;primaryKey" json:"id"`
	UserID         uint64     `gorm:"column:user_id" json:"user_id"`
	ProjectID      uint64     `gorm:"column:project_id" json:"project_id"`
	Ranking        *float64   `gorm:"column:ranking" json:"ranking"`
	IsFavorite     bool       `gorm:"column:is_favorite" json:"is_favorite"`
	FavoriteHidden bool       `gorm:"column:favorite_hidden" json:"favorite_hidden"`
	DeletedAt      *time.Time `gorm:"column:deleted_at" json:"deleted_at"`
	CreatedAt      time.Time  `gorm:"column:created_at" json:"created_at"`
	UpdatedAt      time.Time  `gorm:"column:updated_at" json:"updated_at"`
	Project        Project    `gorm:"foreignKey:ProjectID" json:"project"`
}

func (ProjectRanking) TableName() string {
	return "storyteller_project_rankings"
}

type AuthorFavorite struct {
	ID           uint64     `gorm:"column:id;primaryKey" json:"id"`
	UserID       uint64     `gorm:"column:user_id" json:"user_id"`
	AuthorUserID uint64     `gorm:"column:author_user_id" json:"author_user_id"`
	Hidden       bool       `gorm:"column:hidden" json:"hidden"`
	DeletedAt    *time.Time `gorm:"column:deleted_at" json:"deleted_at"`
	CreatedAt    time.Time  `gorm:"column:created_at" json:"created_at"`
	UpdatedAt    time.Time  `gorm:"column:updated_at" json:"updated_at"`
}

func (AuthorFavorite) TableName() string {
	return "storyteller_author_favorites"
}

type UserProfile struct {
	ID                      uint64     `gorm:"column:id;primaryKey" json:"id"`
	UserID                  uint64     `gorm:"column:user_id" json:"user_id"`
	PenName                 string     `gorm:"column:pen_name" json:"pen_name"`
	Bio                     string     `gorm:"column:bio" json:"bio"`
	UseDefaultAvatar        bool       `gorm:"column:use_default_avatar" json:"use_default_avatar"`
	AvatarURL               string     `gorm:"column:avatar_url" json:"avatar_url"`
	SNSLinks                SNSLinks   `gorm:"column:sns_links;type:json" json:"sns_links"`
	HideFavoriteProjects    bool       `gorm:"column:hide_favorite_projects" json:"hide_favorite_projects"`
	HideFavoriteAuthors     bool       `gorm:"column:hide_favorite_authors" json:"hide_favorite_authors"`
	AutoSaveEnabled         bool       `gorm:"column:auto_save_enabled" json:"auto_save_enabled"`
	AutoSaveIntervalMinutes int        `gorm:"column:auto_save_interval_minutes" json:"auto_save_interval_minutes"`
	DeletedAt               *time.Time `gorm:"column:deleted_at" json:"deleted_at"`
	CreatedAt               time.Time  `gorm:"column:created_at" json:"created_at"`
	UpdatedAt               time.Time  `gorm:"column:updated_at" json:"updated_at"`
}

func (UserProfile) TableName() string {
	return "storyteller_users"
}

// PersonalAccessToken 供外部工具（如 MCP client）以 Bearer token 存取 storyteller API，
// 只存 SHA-256 雜湊，明碼只在建立當下回傳一次。
type PersonalAccessToken struct {
	ID          uint64     `gorm:"column:id;primaryKey" json:"id"`
	UserID      uint64     `gorm:"column:user_id" json:"user_id"`
	Label       string     `gorm:"column:label" json:"label"`
	TokenHash   string     `gorm:"column:token_hash" json:"-"`
	TokenPrefix string     `gorm:"column:token_prefix" json:"token_prefix"`
	LastUsedAt  *time.Time `gorm:"column:last_used_at" json:"last_used_at"`
	ExpiresAt   *time.Time `gorm:"column:expires_at" json:"expires_at"`
	IsDeleted   bool       `gorm:"column:is_deleted" json:"-"`
	DeletedAt   *time.Time `gorm:"column:deleted_at" json:"-"`
	CreatedAt   time.Time  `gorm:"column:created_at" json:"created_at"`
	UpdatedAt   time.Time  `gorm:"column:updated_at" json:"updated_at"`
}

func (PersonalAccessToken) TableName() string { return "storyteller_personal_access_tokens" }

type PersonalAccessTokenRequest struct {
	Label         string `json:"label"`
	ExpiresInDays *int   `json:"expires_in_days"`
}

type PersonalAccessTokenOutput struct {
	ID          uint64     `json:"id"`
	Label       string     `json:"label"`
	TokenPrefix string     `json:"token_prefix"`
	LastUsedAt  *time.Time `json:"last_used_at"`
	ExpiresAt   *time.Time `json:"expires_at"`
	CreatedAt   time.Time  `json:"created_at"`
}

// PersonalAccessTokenCreateOutput 多帶一個明碼 Token，只在建立當下回傳一次，之後查不到。
type PersonalAccessTokenCreateOutput struct {
	PersonalAccessTokenOutput
	Token string `json:"token"`
}

type ProjectRequest struct {
	Name        string             `json:"name"`
	Slug        string             `json:"slug"`
	Description string             `json:"description"`
	Visibility  ProjectVisibility  `json:"visibility"`
	Rating      ProjectRating      `json:"rating"`
	ContentType ProjectContentType `json:"content_type"`
	Tags        []string           `json:"tags"`
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
	Endpoint string        `json:"endpoint"`
	APIKey   string        `json:"api_key"`
}

type ProviderAPIKeyUpdateRequest struct {
	Label    string `json:"label"`
	Endpoint string `json:"endpoint"`
	APIKey   string `json:"api_key"`
}

type ProviderAPIKeyOutput struct {
	ID           uint64        `json:"id"`
	Provider     AgentProvider `json:"provider"`
	Label        string        `json:"label"`
	Endpoint     string        `json:"endpoint"`
	LastTestedAt *time.Time    `json:"last_tested_at"`
	LastTestOK   *bool         `json:"last_test_ok"`
	CreatedAt    time.Time     `json:"created_at"`
	UpdatedAt    time.Time     `json:"updated_at"`
}

type ProviderAPIKeyTestRequest struct {
	ModelName string `json:"model_name"`
}

type StoryRequest struct {
	Title   string      `json:"title"`
	Summary string      `json:"summary"`
	Status  StoryStatus `json:"status"`
	Sort    int         `json:"sort"`
	Content string      `json:"content"`
	// SaveTrigger 只有網頁編輯頁會帶，用來讓後端記錄這次存檔是自動存檔還是手動存檔；
	// 值只會是 "auto" 或 "manual"，其他呼叫端（如 MCP）留空即可。
	SaveTrigger string `json:"save_trigger,omitempty"`
	// BaseVersionID 是呼叫端目前手上內容對應的版本 id；更新時如果這篇故事的最新版本
	// 已經不是這個 id，代表內容被別的呼叫端動過，後端會拒絕這次存檔並回 409，
	// 不會覆蓋掉那個更新。留空（nil）就不檢查，直接往最新版本後面接一版。
	BaseVersionID *uint64 `json:"base_version_id,omitempty"`
	// ParentID 是所屬冊的 public_id；空字串或 nil 代表移出冊／不分冊。
	// 只能指向 is_volume=true 的故事，後端會驗證。
	ParentID *string `json:"parent_id,omitempty"`
	// ContentType 只有建立時會用到（text=一般文字故事，image=圖像作品），更新時忽略此欄位。
	ContentType ProjectContentType `json:"content_type,omitempty"`
}

// StoryVolumeRequest 是冊的建立／重新命名請求，刻意跟 StoryRequest 分開、
// 只有標題欄位——冊沒有內容／摘要／狀態可以編輯。
type StoryVolumeRequest struct {
	Title string `json:"title"`
	// Sort 用來排彼此之間的順序，跟 StoryRequest.Sort 一樣是每次存檔都要帶目前值，
	// 不是只有拖曳排序時才送——重新命名時如果沒帶，會把 sort 洗成 0。
	Sort int `json:"sort"`
	// Status 是冊本身的公開／未公開狀態。冊關閉（draft）時，底下所有故事一律不對外顯示，
	// 不管故事自己的 status 是什麼——見 Repository.PublishedStories 的 join 邏輯。
	Status StoryStatus `json:"status"`
	// Summary 是這一冊／話給讀者看的說明文字。
	Summary string `json:"summary"`
	// ContentType 只有建立時會用到（決定底下要掛文字故事還是圖像頁），更新時忽略此欄位。
	ContentType ProjectContentType `json:"content_type,omitempty"`
}

// StoryImagePage 是「話」（Story.ContentType=image）JSON 內容裡的單一頁面。
type StoryImagePage struct {
	ID          string `json:"id"`
	Key         string `json:"key"`
	Description string `json:"description"`
	Sort        int    `json:"sort"`
}

// StoryImageContent 是 Story.LatestContent／StoryVersion.Content 在 ContentType=image
// 時實際存放的 JSON 結構，取代原本獨立的 storyteller_image_pages 表——一「話」的所有頁面
// 就是一筆 Story 存檔，版本歷史／回復完全沿用既有的 Story 機制，不需要另外處理。
type StoryImageContent struct {
	Pages []StoryImagePage `json:"pages"`
}

// StoryImagePageOutput 是讀取時輸出用的形狀，ImageURL 是簽過名的 CloudFront 網址
// （讀取當下才簽，不落地存）。Key 只有作者本人的管理頁（Service.ImageStoryPages）
// 會填值，用來讓編輯頁重組完整 JSON 存回去；公開／分享閱讀頁（PublicImageStoryPages／
// SharedImageStoryPages）不會填這個欄位，讀者不需要也不該拿到原始 S3 key。
type StoryImagePageOutput struct {
	ID          string `json:"id"`
	Key         string `json:"key,omitempty"`
	ImageURL    string `json:"image_url"`
	Description string `json:"description"`
	Sort        int    `json:"sort"`
}

// ImagePageUploadRequest 是 presign 請求，逐檔案帶 content type：一來讓伺服器能驗證
// 是不是允許的圖片類型，二來把它綁進 S3 PutObjectInput.ContentType，讓上傳當下送出的
// Content-Type header 必須跟這裡宣告的一致，signature 才會過。
type ImagePageUploadRequest struct {
	ContentTypes []string `json:"content_types"`
}

// ImagePageUploadOutput 是單張圖的 presigned PUT 網址跟對應的 S3 object key，
// 呼叫端上傳成功後把 Key 原樣帶回 ImagePageRequest.Key 供後續建立頁面時關聯。
type ImagePageUploadOutput struct {
	Key       string `json:"key"`
	UploadURL string `json:"upload_url"`
}

type AssetUploadFileRequest struct {
	ContentType      string `json:"content_type"`
	OriginalFilename string `json:"original_filename"`
}

type AssetUploadRequest struct {
	Files []AssetUploadFileRequest `json:"files"`
}

type AssetUploadOutput struct {
	Key              string `json:"key"`
	UploadURL        string `json:"upload_url"`
	ContentType      string `json:"content_type"`
	OriginalFilename string `json:"original_filename"`
}

type AssetConfirmRequest struct {
	Key              string        `json:"key"`
	ContentType      string        `json:"content_type"`
	CollectionID     string        `json:"collection_id"`
	OriginalFilename string        `json:"original_filename"`
	Title            string        `json:"title"`
	AltText          string        `json:"alt_text"`
	Description      string        `json:"description"`
	Metadata         AssetMetadata `json:"metadata"`
}

type AssetUpdateRequest struct {
	Title       string        `json:"title"`
	AltText     string        `json:"alt_text"`
	Description string        `json:"description"`
	Metadata    AssetMetadata `json:"metadata"`
}

type AssetMoveRequest struct {
	CollectionID string `json:"collection_id"`
}

type AssetCollectionRequest struct {
	Name string `json:"name"`
	Sort int    `json:"sort"`
}

type AssetOutput struct {
	ID               uint64        `json:"id"`
	PublicID         string        `json:"public_id"`
	ProjectID        uint64        `json:"project_id"`
	CollectionID     string        `json:"collection_id,omitempty"`
	AssetType        AssetType     `json:"asset_type"`
	MimeType         string        `json:"mime_type"`
	FileExt          string        `json:"file_ext"`
	FileSize         uint64        `json:"file_size"`
	Metadata         AssetMetadata `json:"metadata"`
	OriginalFilename string        `json:"original_filename"`
	Title            string        `json:"title"`
	AltText          string        `json:"alt_text"`
	Description      string        `json:"description"`
	PreviewURL       string        `json:"preview_url"`
	ReferenceCount   int64         `json:"reference_count"`
	CreatedAt        time.Time     `json:"created_at"`
	UpdatedAt        time.Time     `json:"updated_at"`
}

type AssetPageOutput struct {
	Assets     []AssetOutput `json:"assets"`
	TotalCount int64         `json:"total_count"`
	Page       int           `json:"page"`
	PageSize   int           `json:"page_size"`
}

type AssetCollectionOutput struct {
	ID         uint64    `json:"id"`
	PublicID   string    `json:"public_id"`
	ProjectID  uint64    `json:"project_id"`
	Name       string    `json:"name"`
	Sort       int       `json:"sort"`
	AssetCount int64     `json:"asset_count"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type LoreRequest struct {
	Title         string  `json:"title"`
	Content       string  `json:"content"`
	SaveTrigger   string  `json:"save_trigger,omitempty"`
	BaseVersionID *uint64 `json:"base_version_id,omitempty"`
}

type ProjectRankingRequest struct {
	Ranking float64 `json:"ranking"`
}

type FavoriteVisibilityRequest struct {
	Hidden bool `json:"hidden"`
}

type UserProfileRequest struct {
	PenName                 string   `json:"pen_name"`
	Bio                     string   `json:"bio"`
	UseDefaultAvatar        bool     `json:"use_default_avatar"`
	AvatarURL               string   `json:"avatar_url"`
	SNSLinks                SNSLinks `json:"sns_links"`
	HideFavoriteProjects    bool     `json:"hide_favorite_projects"`
	HideFavoriteAuthors     bool     `json:"hide_favorite_authors"`
	AutoSaveEnabled         bool     `json:"auto_save_enabled"`
	AutoSaveIntervalMinutes int      `json:"auto_save_interval_minutes"`
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

// AgentUsageSummaryRow 是指定月份下，某把 Key 底下某個 Agent 的 token 用量加總，
// 前端依 provider_apikey_id 再依 agent_id 分組即可組出「Key -> Agent」兩層報表。
type AgentUsageSummaryRow struct {
	ProviderAPIKeyID    uint64        `gorm:"column:provider_apikey_id" json:"provider_apikey_id"`
	Provider            AgentProvider `gorm:"column:provider" json:"provider"`
	ProviderAPIKeyLabel string        `gorm:"column:provider_apikey_label" json:"provider_apikey_label"`
	AgentID             uint64        `gorm:"column:agent_id" json:"agent_id"`
	AgentName           string        `gorm:"column:agent_name" json:"agent_name"`
	ModelName           string        `gorm:"column:model_name" json:"model_name"`
	InputTokens         int64         `gorm:"column:input_tokens" json:"input_tokens"`
	OutputTokens        int64         `gorm:"column:output_tokens" json:"output_tokens"`
	TotalTokens         int64         `gorm:"column:total_tokens" json:"total_tokens"`
	RunCount            int64         `gorm:"column:run_count" json:"run_count"`
}

// AgentUsageLogRow 是單次執行的明細，StoryTitle/LoreTitle 兩者互斥，依該次執行是故事還是世界觀設定而定。
type AgentUsageLogRow struct {
	ID           uint64    `gorm:"column:id" json:"id"`
	CreatedAt    time.Time `gorm:"column:created_at" json:"created_at"`
	ModelName    string    `gorm:"column:model_name" json:"model_name"`
	InputTokens  int       `gorm:"column:input_tokens" json:"input_tokens"`
	OutputTokens int       `gorm:"column:output_tokens" json:"output_tokens"`
	TotalTokens  int       `gorm:"column:total_tokens" json:"total_tokens"`
	StoryTitle   *string   `gorm:"column:story_title" json:"story_title,omitempty"`
	LoreTitle    *string   `gorm:"column:lore_title" json:"lore_title,omitempty"`
}

type UserProfileOutput struct {
	UserID                  uint64    `json:"user_id"`
	PenName                 string    `json:"pen_name"`
	Bio                     string    `json:"bio,omitempty"`
	UseDefaultAvatar        bool      `json:"use_default_avatar"`
	AvatarURL               string    `json:"avatar_url,omitempty"`
	SNSLinks                SNSLinks  `json:"sns_links,omitempty"`
	HideFavoriteProjects    bool      `json:"hide_favorite_projects"`
	HideFavoriteAuthors     bool      `json:"hide_favorite_authors"`
	AutoSaveEnabled         bool      `json:"auto_save_enabled"`
	AutoSaveIntervalMinutes int       `json:"auto_save_interval_minutes"`
	CreatedAt               time.Time `json:"created_at"`
}

type FavoriteAuthorOutput struct {
	UserProfileOutput
	ProjectCount    uint64  `json:"project_count"`
	StoryCount      uint64  `json:"story_count"`
	ImageStoryCount uint64  `json:"image_story_count"`
	RatingCount     uint64  `json:"rating_count"`
	AverageRating   float64 `json:"average_rating"`
	FollowerCount   uint64  `json:"follower_count"`
	Hidden          bool    `json:"hidden,omitempty"`
}

type ProjectOutput struct {
	Project
	AverageRating  float64  `gorm:"-" json:"average_rating"`
	RatingCount    uint64   `gorm:"-" json:"rating_count"`
	FavoriteCount  uint64   `gorm:"-" json:"favorite_count"`
	FavoriteHidden bool     `gorm:"-" json:"favorite_hidden,omitempty"`
	IsFavorite     bool     `gorm:"-" json:"is_favorite"`
	TagList        []string `gorm:"-" json:"tags"`
	Stories        []Story  `gorm:"-" json:"stories,omitempty"`
	// Volumes 讓閱讀頁／工作台故事列表可以把 Stories 依冊分組顯示，不需要另外呼叫
	// 只給登入使用者用的 /projects/:project/volumes。
	Volumes []Story              `gorm:"-" json:"volumes,omitempty"`
	Author  *ProjectAuthorOutput `gorm:"-" json:"author,omitempty"`
}

// ProjectAuthorOutput 只在故事閱讀頁（PublicProject／SharedProject）才會帶
// FollowerCount——那兩個入口單獨補查一次作者收藏數；其餘會共用 projectOutput 的
// 專案列表／編輯頁不會多跑這個查詢，FollowerCount 留 nil，前端就不會顯示這個數字。
type ProjectAuthorOutput struct {
	UserProfileOutput
	FollowerCount *uint64 `json:"follower_count,omitempty"`
}
