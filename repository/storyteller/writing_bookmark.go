package storyteller

import (
	storytellerModel "faryne.dev/model/entity/storyteller"
)

// WritingBookmarksByStory 列出這位使用者在這篇故事的編輯頁書籤。
func (r *Repository) WritingBookmarksByStory(userID, storyID uint64) ([]storytellerModel.WritingBookmark, error) {
	rows := make([]storytellerModel.WritingBookmark, 0)
	err := r.db.Where("user_id = ? AND story_id = ?", userID, storyID).
		Order("id ASC").
		Find(&rows).Error
	return rows, err
}

// WritingBookmarksByLore 列出這位使用者在這篇設定集的編輯頁書籤。
func (r *Repository) WritingBookmarksByLore(userID, loreID uint64) ([]storytellerModel.WritingBookmark, error) {
	rows := make([]storytellerModel.WritingBookmark, 0)
	err := r.db.Where("user_id = ? AND lore_id = ?", userID, loreID).
		Order("id ASC").
		Find(&rows).Error
	return rows, err
}

// WritingBookmarkByStoryMarker 查同一段落是否已經有書籤（unique 的應用層對應）。
func (r *Repository) WritingBookmarkByStoryMarker(userID, storyID uint64, markerID string) (*storytellerModel.WritingBookmark, error) {
	var row storytellerModel.WritingBookmark
	err := r.db.Where("user_id = ? AND story_id = ? AND marker_id = ?", userID, storyID, markerID).
		First(&row).Error
	return &row, err
}

// WritingBookmarkByLoreMarker 是 WritingBookmarkByStoryMarker 的設定集版本。
func (r *Repository) WritingBookmarkByLoreMarker(userID, loreID uint64, markerID string) (*storytellerModel.WritingBookmark, error) {
	var row storytellerModel.WritingBookmark
	err := r.db.Where("user_id = ? AND lore_id = ? AND marker_id = ?", userID, loreID, markerID).
		First(&row).Error
	return &row, err
}

func (r *Repository) CreateWritingBookmark(row *storytellerModel.WritingBookmark) error {
	return r.db.Create(row).Error
}

func (r *Repository) UpdateWritingBookmarkNote(id uint64, note *string) error {
	return r.db.Model(&storytellerModel.WritingBookmark{}).
		Where("id = ?", id).
		Update("note", note).Error
}

func (r *Repository) DeleteWritingBookmarkByStoryMarker(userID, storyID uint64, markerID string) error {
	return r.db.Where("user_id = ? AND story_id = ? AND marker_id = ?", userID, storyID, markerID).
		Delete(&storytellerModel.WritingBookmark{}).Error
}

func (r *Repository) DeleteWritingBookmarkByLoreMarker(userID, loreID uint64, markerID string) error {
	return r.db.Where("user_id = ? AND lore_id = ? AND marker_id = ?", userID, loreID, markerID).
		Delete(&storytellerModel.WritingBookmark{}).Error
}
