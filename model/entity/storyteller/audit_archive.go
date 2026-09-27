package storyteller

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

type AuditExportStatus string

const (
	AuditExportStatusExported AuditExportStatus = "exported"
	AuditExportStatusFailed   AuditExportStatus = "failed"
)

// StringList 以 JSON array 存進 MySQL JSON 欄位（S3 object keys 等）。
type StringList []string

func (l StringList) Value() (driver.Value, error) {
	if l == nil {
		return nil, nil
	}
	return json.Marshal(l)
}

func (l *StringList) Scan(value any) error {
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
		return fmt.Errorf("cannot scan %T into StringList", value)
	}
	return json.Unmarshal(data, l)
}

// AuditExport 是一個月份的封存匯出紀錄；mysql_purged_at／archive_purged_at 記錄
// 兩段依保存政策刪除的時間，刪除後這筆紀錄仍保留作為證明。
type AuditExport struct {
	ID              uint64            `gorm:"column:id;primaryKey"`
	Month           string            `gorm:"column:month"`
	Status          AuditExportStatus `gorm:"column:status"`
	RowCount        uint64            `gorm:"column:row_count"`
	MaxEventID      uint64            `gorm:"column:max_event_id"` // 已匯出的最大 event id；purge 只刪 id <= 這個值，晚到的事件會補匯
	ObjectKeys      StringList        `gorm:"column:object_keys;type:json"`
	Checksum        *string           `gorm:"column:checksum"`
	RetainUntil     *time.Time        `gorm:"column:retain_until"`
	ErrorMessage    *string           `gorm:"column:error_message"`
	ExportedAt      *time.Time        `gorm:"column:exported_at"`
	MySQLPurgedAt   *time.Time        `gorm:"column:mysql_purged_at"`
	ArchivePurgedAt *time.Time        `gorm:"column:archive_purged_at"`
	CreatedAt       time.Time         `gorm:"column:created_at"`
	UpdatedAt       time.Time         `gorm:"column:updated_at"`
}

func (AuditExport) TableName() string { return "storyteller_audit_exports" }

type AuditArchiveQueryStatus string

const (
	AuditArchiveQueryQueued    AuditArchiveQueryStatus = "queued"
	AuditArchiveQueryRunning   AuditArchiveQueryStatus = "running"
	AuditArchiveQuerySucceeded AuditArchiveQueryStatus = "succeeded"
	AuditArchiveQueryFailed    AuditArchiveQueryStatus = "failed"
	AuditArchiveQueryExpired   AuditArchiveQueryStatus = "expired"
)

// AuditArchiveFilters 是封存查詢的篩選條件；與近期查詢相同的欄位語意，但一定限定月份範圍。
type AuditArchiveFilters struct {
	ProjectPublicID      string `json:"project_public_id,omitempty"`
	Category             string `json:"category,omitempty"`
	Source               string `json:"source,omitempty"`
	Outcome              string `json:"outcome,omitempty"`
	CredentialRef        string `json:"credential_ref,omitempty"`
	IncludeLowImportance bool   `json:"include_low_importance,omitempty"`
}

func (f AuditArchiveFilters) Value() (driver.Value, error) { return json.Marshal(f) }

func (f *AuditArchiveFilters) Scan(value any) error {
	switch v := value.(type) {
	case nil:
		*f = AuditArchiveFilters{}
		return nil
	case []byte:
		return json.Unmarshal(v, f)
	case string:
		return json.Unmarshal([]byte(v), f)
	default:
		return fmt.Errorf("cannot scan %T into AuditArchiveFilters", value)
	}
}

// AuditArchiveQuery 是一次封存查詢 job；execution_id 是 Athena 的查詢 ID，只留在後端。
type AuditArchiveQuery struct {
	ID            uint64                  `gorm:"column:id;primaryKey"`
	PublicID      string                  `gorm:"column:public_id"`
	UserID        uint64                  `gorm:"column:user_id"`
	Scope         AuditEventScope         `gorm:"column:scope"`
	ProjectID     *uint64                 `gorm:"column:project_id"`
	MonthFrom     string                  `gorm:"column:month_from"`
	MonthTo       string                  `gorm:"column:month_to"`
	Filters       AuditArchiveFilters     `gorm:"column:filters;type:json"`
	ExecutionID   *string                 `gorm:"column:execution_id"`
	Status        AuditArchiveQueryStatus `gorm:"column:status"`
	ErrorCategory *string                 `gorm:"column:error_category"`
	ScannedBytes  *uint64                 `gorm:"column:scanned_bytes"`
	CompletedAt   *time.Time              `gorm:"column:completed_at"`
	CreatedAt     time.Time               `gorm:"column:created_at"`
	UpdatedAt     time.Time               `gorm:"column:updated_at"`
}

func (AuditArchiveQuery) TableName() string { return "storyteller_audit_archive_queries" }

type AuditArchiveQueryRequest struct {
	MonthFrom string              `json:"month_from"`
	MonthTo   string              `json:"month_to"`
	Filters   AuditArchiveFilters `json:"filters"`
}

// AuditArchiveMonthOutput 不帶筆數：匯出是整站按月份做的，筆數是全站總量，不能給一般使用者看。
type AuditArchiveMonthOutput struct {
	Month  string `json:"month"`
	Status string `json:"status"` // available／purged
}

type AuditArchiveMonthsOutput struct {
	ArchiveAvailable bool                      `json:"archive_available"`
	Months           []AuditArchiveMonthOutput `json:"months"`
	RetentionYears   int                       `json:"retention_years"`
	LatestMonth      string                    `json:"latest_archive_month,omitempty"`
	MaxSpanMonths    int                       `json:"max_span_months"`
}

type AuditArchiveQueryOutput struct {
	QueryPublicID string                  `json:"query_public_id"`
	Status        AuditArchiveQueryStatus `json:"status"`
	MonthFrom     string                  `json:"month_from"`
	MonthTo       string                  `json:"month_to"`
	Filters       AuditArchiveFilters     `json:"filters"`
	ErrorCategory string                  `json:"error_category,omitempty"`
	ScannedBytes  *uint64                 `json:"scanned_bytes,omitempty"`
	PollAfterMs   int                     `json:"poll_after_ms"`
	CreatedAt     time.Time               `json:"created_at"`
	CompletedAt   *time.Time              `json:"completed_at,omitempty"`
}

type AuditArchiveResultsOutput struct {
	Events     []AuditEventOutput `json:"events"`
	NextCursor string             `json:"next_cursor,omitempty"`
	HasMore    bool               `json:"has_more"`
}
