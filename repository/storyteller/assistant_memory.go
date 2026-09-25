package storyteller

import (
	"errors"
	"strings"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrAssistantMemorySupersedeConflict = errors.New("assistant memory selected for replacement is unavailable, pinned, or outside this scope")

// ActiveAssistantMemories 只讀取尚未刪除、也未被新版取代的記憶。帳號與專案記憶
// 永遠一起載入；storyID／loreID 有值時再疊加目前編輯目標的記憶。
func (r *Repository) ActiveAssistantMemories(userID, projectID uint64, storyID, loreID *uint64, limit int) ([]storytellerModel.AssistantMemory, error) {
	rows := make([]storytellerModel.AssistantMemory, 0)
	err := r.activeAssistantMemoriesQuery(userID, projectID, storyID, loreID).
		Order("is_pinned DESC").
		Order("CASE scope_type WHEN 'story' THEN 0 WHEN 'lore' THEN 0 WHEN 'project' THEN 1 ELSE 2 END ASC").
		Order("priority DESC, updated_at DESC, id DESC").
		Limit(limit).
		Find(&rows).Error
	return rows, err
}

func (r *Repository) activeAssistantMemoriesQuery(userID, projectID uint64, storyID, loreID *uint64) *gorm.DB {
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

	return r.db.Where("user_id = ? AND status = ? AND is_deleted = 0 AND deleted_at IS NULL AND superseded_by_id IS NULL", userID, storytellerModel.AssistantMemoryStatusConfirmed).
		Where("("+strings.Join(scopeSQL, " OR ")+")", args...)
}

func (r *Repository) CreateAssistantMemory(row *storytellerModel.AssistantMemory) error {
	return r.db.Create(row).Error
}

func (r *Repository) AssistantMemoryByPublicIDForUser(userID uint64, publicID string) (*storytellerModel.AssistantMemory, error) {
	var row storytellerModel.AssistantMemory
	err := r.db.Where("user_id = ? AND public_id = ? AND is_deleted = 0 AND deleted_at IS NULL", userID, publicID).
		First(&row).Error
	return &row, err
}

func (r *Repository) SearchAssistantMemories(userID, projectID uint64, storyID, loreID *uint64, keyword string, limit int) ([]storytellerModel.AssistantMemory, error) {
	pattern := "%" + strings.ToLower(strings.TrimSpace(keyword)) + "%"
	rows := make([]storytellerModel.AssistantMemory, 0)
	err := r.activeAssistantMemoriesQuery(userID, projectID, storyID, loreID).
		Where("(LOWER(COALESCE(memory_name, '')) LIKE ? OR LOWER(content) LIKE ?)", pattern, pattern).
		Order("is_pinned DESC, priority DESC, updated_at DESC, id DESC").
		Limit(limit).
		Find(&rows).Error
	return rows, err
}

func (r *Repository) UpdateAssistantMemory(row *storytellerModel.AssistantMemory) (int64, error) {
	result := r.db.Model(&storytellerModel.AssistantMemory{}).
		Where("id = ? AND user_id = ? AND status = ? AND is_deleted = 0", row.ID, row.UserID, storytellerModel.AssistantMemoryStatusConfirmed).
		Updates(map[string]interface{}{
			"memory_name": row.MemoryName, "scope_type": row.ScopeType, "project_id": row.ProjectID,
			"story_id": row.StoryID, "lore_id": row.LoreID, "kind": row.Kind,
			"content": row.Content, "priority": row.Priority, "is_pinned": row.IsPinned,
		})
	return result.RowsAffected, result.Error
}

func (r *Repository) DeleteAssistantMemory(userID, id uint64) (int64, error) {
	now := time.Now()
	result := r.db.Model(&storytellerModel.AssistantMemory{}).
		Where("id = ? AND user_id = ? AND status = ? AND is_deleted = 0", id, userID, storytellerModel.AssistantMemoryStatusConfirmed).
		Updates(map[string]interface{}{"is_deleted": true, "deleted_at": &now})
	return result.RowsAffected, result.Error
}

func (r *Repository) CompleteAssistantMemoryGeneration(id uint64, name, content, supersedesPublicID string, scope storytellerModel.AssistantMemoryScope, kind storytellerModel.AssistantMemoryKind, priority uint8, shouldRemember bool, usage *storytellerModel.AgentRunUsage, usageLog *storytellerModel.AgentUsageLog) error {
	updates := map[string]interface{}{
		"memory_name":          nullableString(name),
		"content":              content,
		"scope_type":           scope,
		"kind":                 kind,
		"priority":             priority,
		"should_remember":      shouldRemember,
		"supersedes_public_id": nullableString(supersedesPublicID),
		"status":               storytellerModel.AssistantMemoryStatusCompleted,
		"error_message":        nil,
	}
	if usage != nil {
		updates["input_tokens"] = usage.InputTokens
		updates["output_tokens"] = usage.OutputTokens
	}
	if err := r.db.Model(&storytellerModel.AssistantMemory{}).
		Where("id = ? AND status = ? AND is_deleted = 0", id, storytellerModel.AssistantMemoryStatusInProgress).
		Updates(updates).Error; err != nil {
		return err
	}
	if usageLog != nil {
		return r.CreateAgentUsageLog(usageLog)
	}
	return nil
}

func (r *Repository) CreateAgentUsageLog(row *storytellerModel.AgentUsageLog) error {
	return r.db.Create(row).Error
}

func (r *Repository) FailAssistantMemoryGeneration(id uint64, message string) error {
	return r.db.Model(&storytellerModel.AssistantMemory{}).
		Where("id = ? AND status = ? AND is_deleted = 0", id, storytellerModel.AssistantMemoryStatusInProgress).
		Updates(map[string]interface{}{
			"status":        storytellerModel.AssistantMemoryStatusFailed,
			"error_message": message,
		}).Error
}

func (r *Repository) FailStaleAssistantMemoryGeneration(id uint64, updatedBefore time.Time, message string) (int64, error) {
	result := r.db.Model(&storytellerModel.AssistantMemory{}).
		Where("id = ? AND status = ? AND updated_at < ? AND is_deleted = 0", id, storytellerModel.AssistantMemoryStatusInProgress, updatedBefore).
		Updates(map[string]interface{}{"status": storytellerModel.AssistantMemoryStatusFailed, "error_message": message})
	return result.RowsAffected, result.Error
}

// ConfirmAssistantMemory 以 guarded update 避免重複確認；成功後把觸發這次整理的
// chat 內所有訊息記成來源，之後可以追查這筆記憶從哪一輪對話形成。
func (r *Repository) ConfirmAssistantMemory(row *storytellerModel.AssistantMemory) (int64, error) {
	now := time.Now()
	var affected int64
	err := r.db.Transaction(func(tx *gorm.DB) error {
		result := tx.Model(&storytellerModel.AssistantMemory{}).
			Where("id = ? AND user_id = ? AND status = ? AND is_deleted = 0", row.ID, row.UserID, storytellerModel.AssistantMemoryStatusCompleted).
			Updates(map[string]interface{}{
				"memory_name":   row.MemoryName,
				"scope_type":    row.ScopeType,
				"project_id":    row.ProjectID,
				"story_id":      row.StoryID,
				"lore_id":       row.LoreID,
				"kind":          row.Kind,
				"content":       row.Content,
				"priority":      row.Priority,
				"is_pinned":     row.IsPinned,
				"status":        storytellerModel.AssistantMemoryStatusConfirmed,
				"confirmed_at":  &now,
				"error_message": nil,
			})
		if result.Error != nil || result.RowsAffected == 0 {
			affected = result.RowsAffected
			return result.Error
		}
		affected = result.RowsAffected
		if row.SupersedesPublicID != nil {
			old := storytellerModel.AssistantMemory{}
			if err := tx.Where("user_id = ? AND public_id = ? AND status = ? AND is_deleted = 0 AND superseded_by_id IS NULL", row.UserID, *row.SupersedesPublicID, storytellerModel.AssistantMemoryStatusConfirmed).
				First(&old).Error; err != nil {
				if errors.Is(err, gorm.ErrRecordNotFound) {
					return ErrAssistantMemorySupersedeConflict
				}
				return err
			}
			if old.IsPinned || old.ScopeType != row.ScopeType || !nullableUint64Equal(old.ProjectID, row.ProjectID) || !nullableUint64Equal(old.StoryID, row.StoryID) || !nullableUint64Equal(old.LoreID, row.LoreID) {
				return ErrAssistantMemorySupersedeConflict
			}
			if result := tx.Model(&storytellerModel.AssistantMemory{}).
				Where("id = ? AND is_pinned = 0 AND superseded_by_id IS NULL", old.ID).
				Update("superseded_by_id", row.ID); result.Error != nil || result.RowsAffected == 0 {
				return ErrAssistantMemorySupersedeConflict
			}
		}
		if row.SourceChatID == nil {
			return nil
		}
		messageIDs := make([]uint64, 0, 2)
		if err := tx.Model(&storytellerModel.StoryChatMessage{}).
			Where("chat_id = ? AND deleted_at IS NULL", *row.SourceChatID).
			Pluck("id", &messageIDs).Error; err != nil {
			return err
		}
		sources := make([]storytellerModel.AssistantMemorySource, 0, len(messageIDs))
		for _, messageID := range messageIDs {
			sources = append(sources, storytellerModel.AssistantMemorySource{MemoryID: row.ID, MessageID: messageID})
		}
		if len(sources) == 0 {
			return nil
		}
		return tx.Clauses(clause.OnConflict{DoNothing: true}).Create(&sources).Error
	})
	return affected, err
}

func (r *Repository) CreateConfirmedAssistantMemory(row *storytellerModel.AssistantMemory) error {
	return r.db.Create(row).Error
}

func (r *Repository) DeleteAssistantMemoryDraft(userID, id uint64) (int64, error) {
	now := time.Now()
	result := r.db.Model(&storytellerModel.AssistantMemory{}).
		Where("id = ? AND user_id = ? AND status != ? AND is_deleted = 0", id, userID, storytellerModel.AssistantMemoryStatusConfirmed).
		Updates(map[string]interface{}{"is_deleted": true, "deleted_at": &now})
	return result.RowsAffected, result.Error
}

func nullableString(value string) interface{} {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return value
}

func nullableUint64Equal(left, right *uint64) bool {
	return left == nil && right == nil || left != nil && right != nil && *left == *right
}
