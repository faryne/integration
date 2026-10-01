package storyteller

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// NotificationKind 決定前端怎麼組文案與內容頁；DB 只存快照 payload，不存整句文字。
// 新增類型只要呼叫 storytellernotify.Notify；需要專屬畫面才在前端加分支，否則用 payload 的通用欄位。
type NotificationKind string

const (
	NotificationKindStoryPublished   NotificationKind = "story.published"
	NotificationKindProjectPublished NotificationKind = "project.published"
	NotificationKindOAuthAuthorized  NotificationKind = "security.oauth.authorized"
	NotificationKindPATCreated       NotificationKind = "security.pat.created"
)

// NotificationRetentionDays 是未鎖定通知的保留天數，超過就由每日排程 hard delete。
const NotificationRetentionDays = 180

// NotificationStory 是新話通知裡每一話的快照。
type NotificationStory struct {
	PublicID    string `json:"public_id"`
	Title       string `json:"title"`
	WordCount   uint   `json:"word_count"`
	VolumeTitle string `json:"volume_title,omitempty"`
}

// NotificationPayload 是寫入當下的顯示快照：作品改名、下架或刪除後，舊通知照樣能顯示，
// 點下去能不能看由 Reader 判斷。各 kind 只填自己用得到的欄位。
type NotificationPayload struct {
	// 通用欄位：沒有專屬畫面的類型只要填這三個，前端遇到不認識的 kind 也會用它們顯示，
	// 新增簡單的通知類型不用改前端。Link 只能是站內路徑（以 / 開頭），前端會擋掉其他值。
	Title string `json:"title,omitempty"`
	Body  string `json:"body,omitempty"`
	Link  string `json:"link,omitempty"`

	// 內容更新（story.published／project.published）
	ProjectPublicID string              `json:"project_public_id,omitempty"`
	ProjectSlug     string              `json:"project_slug,omitempty"`
	ProjectName     string              `json:"project_name,omitempty"`
	Rating          ProjectRating       `json:"rating,omitempty"`
	Authors         []string            `json:"authors,omitempty"`
	Stories         []NotificationStory `json:"stories,omitempty"`
	StoryTotal      int                 `json:"story_total,omitempty"`
	Description     string              `json:"description,omitempty"`
	Tags            []string            `json:"tags,omitempty"`
	WordTotal       uint                `json:"word_total,omitempty"`

	// 安全（security.*）
	ClientName         string     `json:"client_name,omitempty"`
	CredentialPublicID string     `json:"credential_public_id,omitempty"`
	Label              string     `json:"label,omitempty"`
	TokenPrefix        string     `json:"token_prefix,omitempty"`
	ExpiresAt          *time.Time `json:"expires_at,omitempty"`
	Source             string     `json:"source,omitempty"`
	IP                 string     `json:"ip,omitempty"`
	UserAgent          string     `json:"user_agent,omitempty"`
}

func (p NotificationPayload) Value() (driver.Value, error) {
	return json.Marshal(p)
}

func (p *NotificationPayload) Scan(value any) error {
	switch v := value.(type) {
	case nil:
		*p = NotificationPayload{}
		return nil
	case []byte:
		return json.Unmarshal(v, p)
	case string:
		return json.Unmarshal([]byte(v), p)
	default:
		return fmt.Errorf("cannot scan %T into NotificationPayload", value)
	}
}

type Notification struct {
	ID        uint64              `gorm:"column:id;primaryKey"`
	PublicID  string              `gorm:"column:public_id"`
	UserID    uint64              `gorm:"column:user_id"`
	Kind      NotificationKind    `gorm:"column:kind"`
	GroupKey  string              `gorm:"column:group_key"`
	ProjectID *uint64             `gorm:"column:project_id"`
	Payload   NotificationPayload `gorm:"column:payload;type:json"`
	ReadAt    *time.Time          `gorm:"column:read_at"`
	LockedAt  *time.Time          `gorm:"column:locked_at"`
	IsDeleted bool                `gorm:"column:is_deleted"`
	DeletedAt *time.Time          `gorm:"column:deleted_at"`
	CreatedAt time.Time           `gorm:"column:created_at"`
}

func (Notification) TableName() string { return "storyteller_notifications" }

// NotificationFilter 是通知頁的篩選：全部／未讀／已鎖定。
type NotificationFilter string

const (
	NotificationFilterAll    NotificationFilter = "all"
	NotificationFilterUnread NotificationFilter = "unread"
	NotificationFilterLocked NotificationFilter = "locked"
)

// NotificationOutput 是對外輸出：不帶內部 id 與 group_key。ExpiresAt 為 nil 代表已鎖定、不會被清除。
type NotificationOutput struct {
	PublicID  string              `json:"public_id"`
	Kind      NotificationKind    `json:"kind"`
	Payload   NotificationPayload `json:"payload"`
	Read      bool                `json:"read"`
	Locked    bool                `json:"locked"`
	ExpiresAt *time.Time          `json:"expires_at"`
	CreatedAt time.Time           `json:"created_at"`
}

type NotificationListOutput struct {
	Items       []NotificationOutput `json:"items"`
	NextCursor  string               `json:"next_cursor"`
	UnreadCount int64                `json:"unread_count"`
	LockedCount int64                `json:"locked_count"`
	LockLimit   int                  `json:"lock_limit"`
}

// NotificationPublishCandidate 是發佈掃描撈到的「現在可見、但還沒通知過」的一話。
type NotificationPublishCandidate struct {
	ID              uint64 `gorm:"column:id"`
	PublicID        string `gorm:"column:public_id"`
	ProjectID       uint64 `gorm:"column:project_id"`
	Title           string `gorm:"column:title"`
	WordCount       uint   `gorm:"column:word_count"`
	VolumeTitle     string `gorm:"column:volume_title"`
	ProjectPublicID string `gorm:"column:project_public_id"`
	ProjectUserID   uint64 `gorm:"column:project_user_id"`
}
