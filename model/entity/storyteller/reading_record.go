package storyteller

import "time"

// ReadingTargetType 是閱讀進度記錄的對象種類；圖像作品也是 Story，所以跟文字故事共用 story。
type ReadingTargetType string

const (
	ReadingTargetStory ReadingTargetType = "story"
	ReadingTargetLore  ReadingTargetType = "lore"
)

// ReadingRecordMaxBatch 是單次寫入的上限；未登入時累積在 localStorage 的紀錄，登入後會一次批次補寫。
const ReadingRecordMaxBatch = 500

// ReadingRecord 是讀者對單篇內容的閱讀進度。Progress 是讀過的最遠位置（0～100），只增不減；
// CompletedAt 是第一次讀到 100% 的時間，nil 代表還沒讀完。
type ReadingRecord struct {
	ID          uint64            `gorm:"column:id;primaryKey"`
	UserID      uint64            `gorm:"column:user_id"`
	ProjectID   uint64            `gorm:"column:project_id"`
	TargetType  ReadingTargetType `gorm:"column:target_type"`
	TargetID    uint64            `gorm:"column:target_id"`
	Progress    uint8             `gorm:"column:progress"`
	CompletedAt *time.Time        `gorm:"column:completed_at"`
	CreatedAt   time.Time         `gorm:"column:created_at"`
	UpdatedAt   time.Time         `gorm:"column:updated_at"`
}

func (ReadingRecord) TableName() string { return "storyteller_reading_records" }

// ReadingRecordInput 是前端回報的單筆進度，以 public_id 指定對象。
type ReadingRecordInput struct {
	TargetType     ReadingTargetType `json:"target_type"`
	TargetPublicID string            `json:"target_public_id"`
	Progress       int               `json:"progress"`
}

// ReadingRecordOutput 是回給讀者的進度；UpdatedAt 給「繼續閱讀」判斷最近讀的是哪一篇。
type ReadingRecordOutput struct {
	TargetType     ReadingTargetType `json:"target_type"`
	TargetPublicID string            `json:"target_public_id"`
	Progress       uint8             `json:"progress"`
	CompletedAt    *time.Time        `json:"completed_at"`
	UpdatedAt      time.Time         `json:"updated_at"`
}
