package storyteller

import (
	"database/sql/driver"
	"encoding/json"
	"fmt"
	"time"
)

// RoleScopeType 決定一個 Role 是掛在特定 Project 底下，還是平台層級（管理後台）。
// 兩者權限命名空間完全分開，不能互相推導權限；第一批只交付 project scope。
type RoleScopeType string

const (
	RoleScopeTypeProject  RoleScopeType = "project"
	RoleScopeTypePlatform RoleScopeType = "platform"
)

// PermissionKey 是穩定的 scope/action key，只能由程式碼／migration 定義，不開放
// 角色建立者自訂字串——避免權限檢查用字串比對散落各處、名稱打錯就悄悄放行。
type PermissionKey string

const (
	PermissionProjectRead   PermissionKey = "project.read"
	PermissionProjectUpdate PermissionKey = "project.update"

	PermissionStoryCreate PermissionKey = "story.create"
	PermissionStoryRead   PermissionKey = "story.read"
	PermissionStoryUpdate PermissionKey = "story.update"

	PermissionVolumeCreate PermissionKey = "volume.create"
	PermissionVolumeRead   PermissionKey = "volume.read"
	PermissionVolumeUpdate PermissionKey = "volume.update"

	PermissionLoreCreate PermissionKey = "lore.create"
	PermissionLoreRead   PermissionKey = "lore.read"
	PermissionLoreUpdate PermissionKey = "lore.update"

	PermissionLoreCollectionCreate PermissionKey = "lore_collection.create"
	PermissionLoreCollectionRead   PermissionKey = "lore_collection.read"
	PermissionLoreCollectionUpdate PermissionKey = "lore_collection.update"

	PermissionAssetCollectionCreate PermissionKey = "asset_collection.create"
	PermissionAssetCollectionRead   PermissionKey = "asset_collection.read"
	PermissionAssetCollectionUpdate PermissionKey = "asset_collection.update"

	PermissionAssetCreate PermissionKey = "asset.create"
	PermissionAssetRead   PermissionKey = "asset.read"
	PermissionAssetUpdate PermissionKey = "asset.update"
)

// Role 是可重用的權限集合定義。project scope 一定帶 ProjectID；platform scope 的
// ProjectID 是 nil。
type Role struct {
	ID              uint64        `gorm:"column:id;primaryKey" json:"id"`
	Name            string        `gorm:"column:name" json:"name"`
	ScopeType       RoleScopeType `gorm:"column:scope_type" json:"scope_type"`
	ProjectID       *uint64       `gorm:"column:project_id" json:"project_id"`
	CreatedByUserID uint64        `gorm:"column:created_by_user_id" json:"created_by_user_id"`
	DisabledAt      *time.Time    `gorm:"column:disabled_at" json:"disabled_at"`
	CreatedAt       time.Time     `gorm:"column:created_at" json:"created_at"`
	UpdatedAt       time.Time     `gorm:"column:updated_at" json:"updated_at"`
}

func (Role) TableName() string { return "storyteller_roles" }

// Permission 是系統定義的權限字典，只由 migration seed，不接受角色建立者新增。
type Permission struct {
	ID          uint64        `gorm:"column:id;primaryKey" json:"id"`
	Key         PermissionKey `gorm:"column:key" json:"key"`
	ScopeType   RoleScopeType `gorm:"column:scope_type" json:"scope_type"`
	Description string        `gorm:"column:description" json:"description"`
	CreatedAt   time.Time     `gorm:"column:created_at" json:"created_at"`
	UpdatedAt   time.Time     `gorm:"column:updated_at" json:"updated_at"`
}

func (Permission) TableName() string { return "storyteller_permissions" }

// RolePermission 是 Role 與 Permission 的多對多關聯，複合主鍵 (role_id, permission_id)。
type RolePermission struct {
	RoleID       uint64    `gorm:"column:role_id;primaryKey" json:"role_id"`
	PermissionID uint64    `gorm:"column:permission_id;primaryKey" json:"permission_id"`
	CreatedAt    time.Time `gorm:"column:created_at" json:"created_at"`
}

func (RolePermission) TableName() string { return "storyteller_role_permissions" }

// UserRole 代表某個使用者在指定期間內持有某個 Role。是否「目前有效」由
// RevokedAt IS NULL AND StartsAt <= now AND (ExpiresAt IS NULL OR now < ExpiresAt) 判斷。
//
// GrantedByUserID／RevokedByUserID 只是稽核欄位，記錄實際執行動作的人；第一批角色／
// 成員管理是 owner-only，這兩欄不代表任何委託機制——協作者不論被授予什麼 resource
// permission，都沒有管道呼叫角色管理 API。
type UserRole struct {
	ID              uint64     `gorm:"column:id;primaryKey" json:"id"`
	RoleID          uint64     `gorm:"column:role_id" json:"role_id"`
	UserID          uint64     `gorm:"column:user_id" json:"user_id"`
	StartsAt        time.Time  `gorm:"column:starts_at" json:"starts_at"`
	ExpiresAt       *time.Time `gorm:"column:expires_at" json:"expires_at"`
	GrantedByUserID uint64     `gorm:"column:granted_by_user_id" json:"granted_by_user_id"`
	RevokedAt       *time.Time `gorm:"column:revoked_at" json:"revoked_at"`
	RevokedByUserID *uint64    `gorm:"column:revoked_by_user_id" json:"revoked_by_user_id"`
	CreatedAt       time.Time  `gorm:"column:created_at" json:"created_at"`
	UpdatedAt       time.Time  `gorm:"column:updated_at" json:"updated_at"`
}

func (UserRole) TableName() string { return "storyteller_user_roles" }

// ProjectAuditSummary 存一次異動裡各欄位的安全前／後值，不放 token、API key 或全文。
type ProjectAuditSummary map[string]any

func (s ProjectAuditSummary) Value() (driver.Value, error) {
	if s == nil {
		return nil, nil
	}
	data, err := json.Marshal(s)
	if err != nil {
		return nil, err
	}
	return data, nil
}

func (s *ProjectAuditSummary) Scan(value any) error {
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
		return fmt.Errorf("cannot scan %T into ProjectAuditSummary", value)
	}
	if len(data) == 0 {
		*s = nil
		return nil
	}
	return json.Unmarshal(data, s)
}

// ProjectAuditSource 記錄異動實際從哪個介面觸發，供追查用，不影響授權判斷本身。
type ProjectAuditSource string

const (
	ProjectAuditSourceWeb   ProjectAuditSource = "web"
	ProjectAuditSourceMCP   ProjectAuditSource = "mcp"
	ProjectAuditSourceAdmin ProjectAuditSource = "admin"
)

// ProjectAudit 是 append-only 的 Project 異動事件紀錄；不是版本快照，不能靠它還原
// 舊版內容，只能協助追查「誰在何時對什麼東西做了什麼」。
type ProjectAudit struct {
	ID          uint64              `gorm:"column:id;primaryKey" json:"id"`
	ProjectID   uint64              `gorm:"column:project_id" json:"project_id"`
	ActorUserID uint64              `gorm:"column:actor_user_id" json:"actor_user_id"`
	Source      ProjectAuditSource  `gorm:"column:source" json:"source"`
	Action      string              `gorm:"column:action" json:"action"`
	TargetType  string              `gorm:"column:target_type" json:"target_type"`
	TargetID    string              `gorm:"column:target_id" json:"target_id"`
	Summary     ProjectAuditSummary `gorm:"column:summary" json:"summary"`
	RequestID   string              `gorm:"column:request_id" json:"request_id"`
	OccurredAt  time.Time           `gorm:"column:occurred_at" json:"occurred_at"`
}

func (ProjectAudit) TableName() string { return "storyteller_project_audits" }
