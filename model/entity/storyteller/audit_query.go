package storyteller

import "time"

// AuditEventScope 決定查詢的權限邊界：project 只看單一專案的事件，account 只看登入者
// 本人的帳號層事件與透過 PAT 發生的事件；兩者都由後端依登入者強制套用，不接受前端指定 user。
type AuditEventScope string

const (
	AuditEventScopeProject AuditEventScope = "project"
	AuditEventScopeAccount AuditEventScope = "account"
)

// AuditEventListParams 是查詢 API 的原始參數（controller 解析 query string 後直接交給 service 驗證）。
type AuditEventListParams struct {
	Cursor               string
	Limit                int
	Actor                string // self／system；留空不限制
	Category             string
	Source               string
	Outcome              string
	CredentialRef        string
	From                 string // RFC 3339；留空預設為 24 小時前
	To                   string // RFC 3339；留空預設為現在
	IncludeLowImportance bool
}

// AuditEventQuery 是 service 驗證完、交給 repository 的查詢條件，時間與游標都已轉成實際值。
type AuditEventQuery struct {
	Scope          AuditEventScope
	ProjectID      uint64
	UserID         uint64
	ActorSelf      bool
	ActorSystem    bool
	Actions        []string // 非空時只查這些 action（類別篩選）
	ExcludeActions []string // 預設排除的低重要度 action
	Source         string
	Outcome        string
	CredentialRef  string
	From           time.Time
	To             time.Time
	CursorAt       *time.Time
	CursorID       uint64
	Limit          int
}

type AuditActorOutput struct {
	Type        AuditActorType `json:"type"`
	DisplayName string         `json:"display_name,omitempty"`
}

type AuditCredentialOutput struct {
	PublicID string `json:"public_id"`
	Label    string `json:"label"`
	Revoked  bool   `json:"revoked"`
}

type AuditTargetOutput struct {
	Type     string `json:"type"`
	PublicID string `json:"public_id"`
	Name     string `json:"name,omitempty"`
}

// AuditEventOutput 對外只露出 public ID 與 allowlist 過的 summary，不回傳內部數字 ID。
type AuditEventOutput struct {
	EventID    string                 `json:"event_id"`
	OccurredAt time.Time              `json:"occurred_at"`
	Actor      AuditActorOutput       `json:"actor"`
	Source     AuditSource            `json:"source"`
	AuthMethod AuditAuthMethod        `json:"auth_method"`
	Credential *AuditCredentialOutput `json:"credential"`
	Action     string                 `json:"action"`
	Category   string                 `json:"category"`
	Importance AuditImportance        `json:"importance"`
	Target     *AuditTargetOutput     `json:"target"`
	Outcome    AuditOutcome           `json:"outcome"`
	Summary    AuditSummary           `json:"summary"`
	IP         string                 `json:"ip,omitempty"`
	UserAgent  string                 `json:"user_agent,omitempty"`
	RequestID  string                 `json:"request_id,omitempty"`
}

type AuditEventPageOutput struct {
	Events            []AuditEventOutput `json:"events"`
	NextCursor        string             `json:"next_cursor,omitempty"`
	HasMore           bool               `json:"has_more"`
	HotFrom           time.Time          `json:"hot_from"`
	WriteDelaySeconds int                `json:"write_delay_seconds"`
}

type AuditFilterOption struct {
	Value string `json:"value"`
	Label string `json:"label,omitempty"`
}

type AuditEventFiltersOutput struct {
	Actors      []AuditFilterOption `json:"actors"`
	Categories  []string            `json:"categories"`
	Credentials []AuditFilterOption `json:"credentials"`
	Sources     []AuditSource       `json:"sources"`
	Outcomes    []AuditOutcome      `json:"outcomes"`
}

// AuditTargetRef 是解析目標名稱時用的 (type, public_id) 組合。
type AuditTargetRef struct {
	Type     string
	PublicID string
}
