package storyteller

import "time"

// LoreDependencyMax 是一則設定最多能設定的依賴數；防劇透清單太長讀者也看不完
const LoreDependencyMax = 20

// LoreDependency 記錄含劇透的設定要求讀者先讀過哪些內容；TargetType 沿用閱讀進度的種類（story／lore）
type LoreDependency struct {
	ID         uint64            `gorm:"column:id;primaryKey"`
	LoreID     uint64            `gorm:"column:lore_id"`
	TargetType ReadingTargetType `gorm:"column:target_type"`
	TargetID   uint64            `gorm:"column:target_id"`
	Sort       int               `gorm:"column:sort"`
	CreatedAt  time.Time         `gorm:"column:created_at"`
}

func (LoreDependency) TableName() string { return "storyteller_lore_dependencies" }

// LoreDependencyRef 是依賴對象對外的形狀：寫入時只需要種類與 public_id，讀取時另外帶上標題給畫面顯示
type LoreDependencyRef struct {
	TargetType     ReadingTargetType `json:"target_type"`
	TargetPublicID string            `json:"target_public_id"`
	Title          string            `json:"title,omitempty"`
}
