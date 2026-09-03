package storyteller

import "time"

// WritingBookmark 是作者在編輯頁加的筆記型書籤，錨在段落 markerId 上。
// 跟讀者閱讀頁的 StoryBookmark 無關：使用者、頁面、資料表都不同。
// StoryID / LoreID 二選一，比照 StoryChat。
type WritingBookmark struct {
	ID        uint64    `gorm:"column:id;primaryKey" json:"id"`
	StoryID   *uint64   `gorm:"column:story_id" json:"story_id,omitempty"`
	LoreID    *uint64   `gorm:"column:lore_id" json:"lore_id,omitempty"`
	UserID    uint64    `gorm:"column:user_id" json:"user_id"`
	MarkerID  string    `gorm:"column:marker_id" json:"marker_id"`
	Note      *string   `gorm:"column:note" json:"note"`
	CreatedAt time.Time `gorm:"column:created_at" json:"created_at"`
	UpdatedAt time.Time `gorm:"column:updated_at" json:"updated_at"`
}

func (WritingBookmark) TableName() string { return "storyteller_writing_bookmarks" }

// WritingBookmarkRequest 給新增／更新／刪除共用：刪除只看 marker_id。
type WritingBookmarkRequest struct {
	MarkerID string `json:"marker_id"`
	Note     string `json:"note"`
}
