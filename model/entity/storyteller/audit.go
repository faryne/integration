package storyteller

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

type AuditSource string
type AuditAuthMethod string
type AuditActorType string
type AuditOutcome string
type AuditImportance string

const (
	AuditSourceWeb  AuditSource = "web"
	AuditSourceAPI  AuditSource = "api"
	AuditSourceMCP  AuditSource = "mcp"
	AuditSourceCron AuditSource = "cron"

	AuditAuthMethodSession AuditAuthMethod = "session"
	AuditAuthMethodPAT     AuditAuthMethod = "pat"
	AuditAuthMethodOAuth   AuditAuthMethod = "oauth"
	AuditAuthMethodNone    AuditAuthMethod = "none"

	AuditActorTypeUser   AuditActorType = "user"
	AuditActorTypeSystem AuditActorType = "system"

	AuditOutcomeSuccess AuditOutcome = "success"
	AuditOutcomeDenied  AuditOutcome = "denied"
	AuditOutcomeFailed  AuditOutcome = "failed"

	AuditImportanceLow    AuditImportance = "low"
	AuditImportanceNormal AuditImportance = "normal"
	AuditImportanceHigh   AuditImportance = "high"
)

type AuditSummary map[string]any

func (s AuditSummary) Value() (driver.Value, error) {
	if s == nil {
		return nil, nil
	}
	return json.Marshal(s)
}

func (s *AuditSummary) Scan(value any) error {
	if value == nil {
		*s = nil
		return nil
	}
	var data []byte
	switch v := value.(type) {
	case []byte:
		data = v
	case string:
		data = []byte(v)
	default:
		return fmt.Errorf("cannot scan %T into AuditSummary", value)
	}
	if len(data) == 0 {
		*s = nil
		return nil
	}
	return json.Unmarshal(data, s)
}

// AuditEvent 是 append-only 稽核事件；不設外鍵，避免目標或使用者刪除後失去追查資料。
type AuditEvent struct {
	ID             uint64          `gorm:"column:id;primaryKey" json:"id"`
	EventID        string          `gorm:"column:event_id" json:"event_id"`
	OccurredAt     time.Time       `gorm:"column:occurred_at" json:"occurred_at"`
	ActorType      AuditActorType  `gorm:"column:actor_type" json:"actor_type"`
	ActorUserID    *uint64         `gorm:"column:actor_user_id" json:"actor_user_id,omitempty"`
	Source         AuditSource     `gorm:"column:source" json:"source"`
	AuthMethod     AuditAuthMethod `gorm:"column:auth_method" json:"auth_method"`
	CredentialRef  *string         `gorm:"column:credential_ref" json:"credential_ref,omitempty"`
	IP             *string         `gorm:"column:ip" json:"ip,omitempty"`
	UserAgent      *string         `gorm:"column:user_agent" json:"user_agent,omitempty"`
	RequestID      *string         `gorm:"column:request_id" json:"request_id,omitempty"`
	ProjectID      *uint64         `gorm:"column:project_id" json:"project_id,omitempty"`
	Action         string          `gorm:"column:action" json:"action"`
	TargetType     *string         `gorm:"column:target_type" json:"target_type,omitempty"`
	TargetPublicID *string         `gorm:"column:target_public_id" json:"target_public_id,omitempty"`
	Outcome        AuditOutcome    `gorm:"column:outcome" json:"outcome"`
	Summary        AuditSummary    `gorm:"column:summary;type:json" json:"summary,omitempty"`
}

func (AuditEvent) TableName() string { return "storyteller_audit_events" }
