package storyteller

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
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
	// 通用欄位：所有類型都必填 Title／Body（純文字、保留換行，不解析 markdown），
	// 有專屬畫面的類型也要填一份文字摘要，前端遇到不認識的 kind 或之後的推播都靠它。
	// Link 選填，站內路徑（以 / 開頭）或 http(s) 外部網址皆可，外部網址前端會另開分頁；
	// 其他協定（javascript: 等）前端不顯示按鈕。
	Title string `json:"title"`
	Body  string `json:"body"`
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

	// 追蹤／收藏（author.followed／project.favorited）：Actor 是追蹤者，TargetPenName 是被追蹤的
	// 是收件人的哪個筆名（本人身份留空）。兩者都是快照，輸出時會依 Internal 即時更新成目前的筆名。
	Actor         *AuthorIdentityOutput `json:"actor,omitempty"`
	TargetPenName string                `json:"target_pen_name,omitempty"`

	// Internal 是後端用的身份鍵，會存進 DB，但輸出前一律清空（見 storytellernotify 的 output）
	Internal *NotificationInternal `json:"internal,omitempty"`
}

// NotificationInternal 是通知裡不能對外輸出的身份鍵：回追、即時查詢筆名都靠它，前端拿不到 id。
type NotificationInternal struct {
	ActorUserID     uint64 `json:"actor_user_id"`
	ActorProfileID  uint64 `json:"actor_profile_id"`
	TargetProfileID uint64 `json:"target_profile_id"`
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
	// FollowBack 只有追蹤／收藏類通知才有：能不能回追、用哪些身份回追
	FollowBack *NotificationFollowBack `json:"follow_back,omitempty"`
}

// NotificationFollowBackState：none 可回追／following 已互相追蹤／unavailable 對方或我的身份已不存在。
type NotificationFollowBackState string

const (
	NotificationFollowBackNone        NotificationFollowBackState = "none"
	NotificationFollowBackFollowing   NotificationFollowBackState = "following"
	NotificationFollowBackUnavailable NotificationFollowBackState = "unavailable"
)

// NotificationFollowBackIdentity 是可以拿來回追的我的身份；IsSelf 為帳號本人（按鈕只寫「回追」）。
type NotificationFollowBackIdentity struct {
	PenName string `json:"pen_name"`
	IsSelf  bool   `json:"is_self,omitempty"`
}

type NotificationFollowBack struct {
	State      NotificationFollowBackState      `json:"state"`
	Identities []NotificationFollowBackIdentity `json:"identities"`
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
