package storyteller

import "time"

type WorkspaceSearchKind string

const (
	WorkspaceSearchKindStory WorkspaceSearchKind = "story"
	WorkspaceSearchKindLore  WorkspaceSearchKind = "lore"
	WorkspaceSearchKindAsset WorkspaceSearchKind = "asset"
)

// WorkspaceSearchSource 是 repository 到 service 的內部查詢形狀；保留完整內容只為了
// 在 service 產生關鍵字附近的 preview，不直接輸出給前端。
type WorkspaceSearchSource struct {
	Kind               WorkspaceSearchKind `gorm:"column:kind" json:"-"`
	PublicID           string              `gorm:"column:public_id" json:"-"`
	ContentType        ProjectContentType  `gorm:"column:content_type" json:"-"`
	Title              string              `gorm:"column:title" json:"-"`
	Summary            string              `gorm:"column:summary" json:"-"`
	Content            string              `gorm:"column:content" json:"-"`
	CollectionPublicID string              `gorm:"column:collection_public_id" json:"-"`
	CollectionName     string              `gorm:"column:collection_name" json:"-"`
	UpdatedAt          time.Time           `gorm:"column:updated_at" json:"-"`
	Relevance          int                 `gorm:"column:relevance" json:"-"`
}

// WorkspaceSearchResult 是工作台跨作品／設定／資產搜尋的共用輸出。
type WorkspaceSearchResult struct {
	Kind               WorkspaceSearchKind `json:"kind"`
	PublicID           string              `json:"public_id"`
	ContentType        ProjectContentType  `json:"content_type,omitempty"`
	Title              string              `json:"title"`
	Context            string              `json:"context"`
	Preview            string              `json:"preview"`
	Location           string              `json:"location"`
	CollectionPublicID string              `json:"collection_id,omitempty"`
	UpdatedAt          time.Time           `json:"updated_at"`
}
