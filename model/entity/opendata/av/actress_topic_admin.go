package av

import "time"

// AVActressTopic 管理員自訂的女優主題（特輯、身材），每週排程依這裡的定義產生主題 JSON
type AVActressTopic struct {
	ID          uint64 `gorm:"column:id;primaryKey"`
	Slug        string `gorm:"column:slug"`
	Title       string `gorm:"column:title"`
	GroupKey    string `gorm:"column:group_key"`
	SortOrder   int    `gorm:"column:sort_order"`
	DefaultSort string `gorm:"column:default_sort"`
	// Conditions ActressTopicConditions 的 JSON
	Conditions string `gorm:"column:conditions"`
	IsEnabled  bool   `gorm:"column:is_enabled"`
	// LastCount／LastGeneratedAt 排程回寫；nil＝儲存後還沒跑過排程
	LastCount       *int       `gorm:"column:last_count"`
	LastGeneratedAt *time.Time `gorm:"column:last_generated_at"`
	IsDeleted       bool       `gorm:"column:is_deleted"`
	DeletedAt       *time.Time `gorm:"column:deleted_at"`
	CreatedBy       *uint64    `gorm:"column:created_by"`
	UpdatedBy       *uint64    `gorm:"column:updated_by"`
	CreatedAt       time.Time  `gorm:"column:created_at"`
	UpdatedAt       time.Time  `gorm:"column:updated_at"`
}

func (AVActressTopic) TableName() string {
	return "av_actress_topics"
}

// ActressTopicSaveRequest 新增／修改自訂主題
type ActressTopicSaveRequest struct {
	Slug        string                 `json:"slug"`
	Title       string                 `json:"title"`
	GroupKey    string                 `json:"group_key"`
	DefaultSort string                 `json:"default_sort"`
	Conditions  ActressTopicConditions `json:"conditions"`
}

// ActressTopicEnabledRequest 啟用／停用
type ActressTopicEnabledRequest struct {
	Enabled bool `json:"enabled"`
}

// ActressTopicSortRequest 調整順序：依新順序排好的主題 id
type ActressTopicSortRequest struct {
	IDs []uint64 `json:"ids"`
}

// ActressTopicAdminItem 管理列表／編輯頁的一筆
type ActressTopicAdminItem struct {
	ID              uint64                 `json:"id"`
	Slug            string                 `json:"slug"`
	Title           string                 `json:"title"`
	GroupKey        string                 `json:"group_key"`
	SortOrder       int                    `json:"sort_order"`
	DefaultSort     string                 `json:"default_sort"`
	Conditions      ActressTopicConditions `json:"conditions"`
	Summary         string                 `json:"summary"`
	IsEnabled       bool                   `json:"is_enabled"`
	LastCount       *int                   `json:"last_count"`
	LastGeneratedAt *time.Time             `json:"last_generated_at"`
	UpdatedAt       time.Time              `json:"updated_at"`
}

// ActressTopicOptions 編輯頁自動完成的選項（facet），依數量排序
type ActressTopicOptions struct {
	BornCities []ActressTopicOption `json:"born_cities"`
	Tags       []ActressTopicOption `json:"tags"`
}

type ActressTopicOption struct {
	Value string `json:"value"`
	Count int    `json:"count"`
}
