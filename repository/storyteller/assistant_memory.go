package storyteller

import (
	"strings"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

// ActiveAssistantMemories 只讀取尚未刪除、也未被新版取代的記憶。帳號與專案記憶
// 永遠一起載入；storyID／loreID 有值時再疊加目前編輯目標的記憶。
func (r *Repository) ActiveAssistantMemories(userID, projectID uint64, storyID, loreID *uint64, limit int) ([]storytellerModel.AssistantMemory, error) {
	scopeSQL := []string{
		"(scope_type = ? AND project_id IS NULL AND story_id IS NULL AND lore_id IS NULL)",
		"(scope_type = ? AND project_id = ? AND story_id IS NULL AND lore_id IS NULL)",
	}
	args := []interface{}{storytellerModel.AssistantMemoryScopeAccount, storytellerModel.AssistantMemoryScopeProject, projectID}
	if storyID != nil {
		scopeSQL = append(scopeSQL, "(scope_type = ? AND project_id IS NULL AND story_id = ? AND lore_id IS NULL)")
		args = append(args, storytellerModel.AssistantMemoryScopeStory, *storyID)
	}
	if loreID != nil {
		scopeSQL = append(scopeSQL, "(scope_type = ? AND project_id IS NULL AND story_id IS NULL AND lore_id = ?)")
		args = append(args, storytellerModel.AssistantMemoryScopeLore, *loreID)
	}

	rows := make([]storytellerModel.AssistantMemory, 0)
	err := r.db.Where("user_id = ? AND is_deleted = 0 AND deleted_at IS NULL AND superseded_by_id IS NULL", userID).
		Where("("+strings.Join(scopeSQL, " OR ")+")", args...).
		Order("is_pinned DESC").
		Order("CASE scope_type WHEN 'story' THEN 0 WHEN 'lore' THEN 0 WHEN 'project' THEN 1 ELSE 2 END ASC").
		Order("priority DESC, updated_at DESC, id DESC").
		Limit(limit).
		Find(&rows).Error
	return rows, err
}
