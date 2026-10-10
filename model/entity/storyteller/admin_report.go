package storyteller

import "time"

// 管理後台的檢舉處理輸出。後台 API 直接用內部 id（只給管理員），文字標籤由前端依種類組合。

// AdminReportPageSize 是後台檢舉列表每頁的對象數。
const AdminReportPageSize = 20

type AdminReportListQuery struct {
	Status     ReportStatus     `query:"status"`
	TargetType ReportTargetType `query:"target_type"`
	Page       int              `query:"page"`
}

// AdminTargetLink 是前台連結需要的識別資料；路徑由前端組（網域前綴依站台而不同）。
type AdminTargetLink struct {
	ProjectPublicID string `json:"project_public_id,omitempty"`
	ProjectSlug     string `json:"project_slug,omitempty"`
	StoryPublicID   string `json:"story_public_id,omitempty"`
	LorePublicID    string `json:"lore_public_id,omitempty"`
	ThreadPublicID  string `json:"thread_public_id,omitempty"`
	PostPublicID    string `json:"post_public_id,omitempty"`
	CommentPublicID string `json:"comment_public_id,omitempty"`
	PenName         string `json:"pen_name,omitempty"`
}

// AdminFootprint 是帳號或筆名目前仍公開的內容數量（停權／移除筆名前讓管理員知道影響範圍）。
type AdminFootprint struct {
	Projects int64 `json:"projects"`
	Posts    int64 `json:"posts"`
	Threads  int64 `json:"threads"`
	Comments int64 `json:"comments"`
}

type AdminReportTarget struct {
	Type ReportTargetType `json:"type"`
	ID   uint64           `json:"id"`
	// Title：作品名／話名／設定名／討論串標題／筆名；留言與動態沒有標題
	Title string `json:"title,omitempty"`
	// OwnerName 是發言（或擁有）身份目前的筆名；身份已不存在時為空
	OwnerName   string `json:"owner_name,omitempty"`
	OwnerUserID uint64 `json:"owner_user_id"`
	Excerpt     string `json:"excerpt,omitempty"`
	// Body 只有詳情才帶（留言／動態／討論串全文）
	Body string `json:"body,omitempty"`
	// Context 是所在位置的名稱：作品名、討論串標題或動態作者
	ContextProject string `json:"context_project,omitempty"`
	ContextThread  string `json:"context_thread,omitempty"`
	Deleted        bool   `json:"deleted,omitempty"`
	// DeleteReason 有值＝站方處置；Deleted 但沒有理由＝作者自行刪除
	DeleteReason string          `json:"delete_reason,omitempty"`
	Link         AdminTargetLink `json:"link"`
	CreatedAt    *time.Time      `json:"created_at,omitempty"`
	// 以下只有創作者（user／author_profile）詳情會帶
	Footprint      *AdminFootprint `json:"footprint,omitempty"`
	AccountPenName string          `json:"account_pen_name,omitempty"`
	ExtraPenNames  []string        `json:"extra_pen_names,omitempty"`
	IsVolume       bool            `json:"is_volume,omitempty"`
}

type AdminReasonCount struct {
	Key   string `json:"key"`
	Count int64  `json:"count"`
}

type AdminReportGroup struct {
	Target AdminReportTarget `json:"target"`
	// Count 是目前分頁狀態下這個對象的檢舉數（待處理分頁＝待處理數）
	Count          int64              `json:"count"`
	Reasons        []AdminReasonCount `json:"reasons"`
	LastReportedAt time.Time          `json:"last_reported_at"`
	LastHandledAt  *time.Time         `json:"last_handled_at,omitempty"`
}

type AdminReportListOutput struct {
	Items  []AdminReportGroup     `json:"items"`
	Total  int64                  `json:"total"`
	Page   int                    `json:"page"`
	Counts map[ReportStatus]int64 `json:"counts"`
}

type AdminReportEntry struct {
	PublicID     string       `json:"public_id"`
	ReasonKey    string       `json:"reason_key"`
	Note         string       `json:"note,omitempty"`
	ReporterName string       `json:"reporter_name,omitempty"`
	Status       ReportStatus `json:"status"`
	HandledBy    string       `json:"handled_by,omitempty"`
	HandledAt    *time.Time   `json:"handled_at,omitempty"`
	CreatedAt    time.Time    `json:"created_at"`
}

// AdminReportActions 是看的人在這個對象上能做什麼；前端只依這裡決定按鈕，不自己判斷權限。
type AdminReportActions struct {
	CanRemove  bool `json:"can_remove"`
	CanDismiss bool `json:"can_dismiss"`
	// CanClose：對象已被作者自行刪除，只能結案
	CanClose bool `json:"can_close"`
	// RemoveReasons 是可用的處置理由（含內部專用），DefaultReason 是被檢舉最多次的原因
	RemoveReasons []string `json:"remove_reasons,omitempty"`
	DefaultReason string   `json:"default_reason,omitempty"`
}

type AdminReportDetailOutput struct {
	Target  AdminReportTarget  `json:"target"`
	Pending int64              `json:"pending"`
	Reasons []AdminReasonCount `json:"reasons"`
	Reports []AdminReportEntry `json:"reports"`
	Actions AdminReportActions `json:"actions"`
}

type AdminRemoveRequest struct {
	ReasonKey string `json:"reason_key"`
}

type AdminMeOutput struct {
	Permissions []PermissionKey `json:"permissions"`
}
