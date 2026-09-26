package storyteller

import (
	"errors"
	"strings"
	"time"

	entityModel "faryne.dev/model/entity"
	storytellerModel "faryne.dev/model/entity/storyteller"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

var ErrAssistantMemorySupersedeConflict = errors.New("assistant memory selected for replacement is unavailable, pinned, or outside this scope")

// ActiveAssistantMemories 只讀取尚未刪除、也未被新版取代的記憶。帳號與專案記憶
// 專案記憶永遠載入；storyID／loreID 有值時再疊加目前編輯目標的記憶。
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
		"(scope_type = ? AND project_id = ? AND story_id IS NULL AND lore_id IS NULL)",
	}
	args := []interface{}{storytellerModel.AssistantMemoryScopeProject, projectID}
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
	pattern := "%" + escapeAssistantMemoryLike(strings.ToLower(strings.TrimSpace(keyword))) + "%"
	rows := make([]storytellerModel.AssistantMemory, 0)
	err := r.activeAssistantMemoriesQuery(userID, projectID, storyID, loreID).
		Where("(LOWER(COALESCE(memory_name, '')) LIKE ? ESCAPE '!' OR LOWER(COALESCE(tags, '')) LIKE ? ESCAPE '!' OR LOWER(content) LIKE ? ESCAPE '!')", pattern, pattern, pattern).
		Order("is_pinned DESC, priority DESC, updated_at DESC, id DESC").
		Limit(limit).
		Find(&rows).Error
	return rows, err
}

// ManageAssistantMemories 提供工作台完整管理頁使用；未指定 story/lore 時會列出
// 目前專案記憶，以及專案底下所有故事／設定的記憶。
func (r *Repository) ManageAssistantMemories(userID, projectID uint64, filter storytellerModel.AssistantMemoryManagementFilter) ([]storytellerModel.AssistantMemoryManagementRow, int64, error) {
	query := r.db.Table("storyteller_assistant_memories AS memories").
		Joins("LEFT JOIN storyteller_projects AS memory_projects ON memory_projects.id = memories.project_id").
		Joins("LEFT JOIN storyteller_stories AS stories ON stories.id = memories.story_id AND stories.is_deleted = 0 AND stories.deleted_at IS NULL").
		Joins("LEFT JOIN storyteller_lores AS lores ON lores.id = memories.lore_id AND lores.is_deleted = 0 AND lores.deleted_at IS NULL").
		Where("memories.user_id = ? AND memories.status = ? AND memories.is_deleted = 0 AND memories.deleted_at IS NULL AND memories.superseded_by_id IS NULL", userID, storytellerModel.AssistantMemoryStatusConfirmed)
	if filter.StoryID != nil {
		query = query.Where("((memories.scope_type = ? AND memories.project_id = ?) OR (memories.scope_type = ? AND memories.story_id = ?))",
			storytellerModel.AssistantMemoryScopeProject, projectID, storytellerModel.AssistantMemoryScopeStory, *filter.StoryID)
	} else if filter.LoreID != nil {
		query = query.Where("((memories.scope_type = ? AND memories.project_id = ?) OR (memories.scope_type = ? AND memories.lore_id = ?))",
			storytellerModel.AssistantMemoryScopeProject, projectID, storytellerModel.AssistantMemoryScopeLore, *filter.LoreID)
	} else {
		query = query.Where("((memories.scope_type = ? AND memories.project_id = ?) OR (memories.scope_type = ? AND stories.project_id = ?) OR (memories.scope_type = ? AND lores.project_id = ?))",
			storytellerModel.AssistantMemoryScopeProject, projectID,
			storytellerModel.AssistantMemoryScopeStory, projectID,
			storytellerModel.AssistantMemoryScopeLore, projectID)
	}
	if filter.Keyword != "" {
		pattern := "%" + escapeAssistantMemoryLike(strings.ToLower(filter.Keyword)) + "%"
		query = query.Where("(LOWER(COALESCE(memories.memory_name, '')) LIKE ? ESCAPE '!' OR LOWER(COALESCE(memories.tags, '')) LIKE ? ESCAPE '!' OR LOWER(memories.content) LIKE ? ESCAPE '!')", pattern, pattern, pattern)
	}
	if filter.MemoryPublicID != "" {
		query = query.Where("memories.public_id = ?", filter.MemoryPublicID)
	}
	if filter.ScopeType != "" {
		query = query.Where("memories.scope_type = ?", filter.ScopeType)
	}
	if filter.Kind != "" {
		query = query.Where("memories.kind = ?", filter.Kind)
	}
	if filter.Tag != "" {
		// 寫入時以不分大小寫方式去重，篩選也必須採相同規則；LOWER 後仍是合法 JSON 字串。
		query = query.Where("JSON_CONTAINS(LOWER(COALESCE(memories.tags, '[]')), JSON_QUOTE(LOWER(?)))", filter.Tag)
	}
	if filter.IsPinned != nil {
		query = query.Where("memories.is_pinned = ?", *filter.IsPinned)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	rows := make([]storytellerModel.AssistantMemoryManagementRow, 0, filter.Limit)
	err := query.Select(`memories.*,
		CASE memories.scope_type WHEN 'project' THEN memory_projects.public_id WHEN 'story' THEN stories.public_id WHEN 'lore' THEN lores.public_id ELSE '' END AS target_public_id,
		CASE memories.scope_type WHEN 'project' THEN memory_projects.name WHEN 'story' THEN stories.title WHEN 'lore' THEN lores.title ELSE '' END AS target_name`).
		Order("memories.is_pinned DESC, memories.priority DESC, memories.updated_at DESC, memories.id DESC").
		Offset(filter.Offset).Limit(filter.Limit).Find(&rows).Error
	return rows, total, err
}

func (r *Repository) UpdateAssistantMemory(row *storytellerModel.AssistantMemory) (int64, error) {
	result := r.db.Model(&storytellerModel.AssistantMemory{}).
		Where("id = ? AND user_id = ? AND status = ? AND is_deleted = 0 AND deleted_at IS NULL AND superseded_by_id IS NULL", row.ID, row.UserID, storytellerModel.AssistantMemoryStatusConfirmed).
		Updates(map[string]interface{}{
			"memory_name": row.MemoryName, "scope_type": row.ScopeType, "project_id": row.ProjectID,
			"story_id": row.StoryID, "lore_id": row.LoreID, "kind": row.Kind, "tags": row.Tags,
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

func (r *Repository) CompleteAssistantMemoryGeneration(id uint64, name, content, tags, supersedesPublicID string, scope storytellerModel.AssistantMemoryScope, kind storytellerModel.AssistantMemoryKind, priority uint8, shouldRemember bool, usage *storytellerModel.AgentRunUsage, usageLog *storytellerModel.AgentUsageLog) error {
	updates := map[string]interface{}{
		"memory_name":          nullableString(name),
		"content":              content,
		"scope_type":           scope,
		"kind":                 kind,
		"tags":                 tags,
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
			Updates(assistantMemoryConfirmUpdates(row, now))
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
			if old.IsPinned || old.ScopeType != row.ScopeType || !entityModel.NullableEqual(old.ProjectID, row.ProjectID) || !entityModel.NullableEqual(old.StoryID, row.StoryID) || !entityModel.NullableEqual(old.LoreID, row.LoreID) {
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

func assistantMemoryConfirmUpdates(row *storytellerModel.AssistantMemory, confirmedAt time.Time) map[string]interface{} {
	return map[string]interface{}{
		"memory_name": row.MemoryName, "scope_type": row.ScopeType, "project_id": row.ProjectID,
		"story_id": row.StoryID, "lore_id": row.LoreID, "kind": row.Kind, "tags": row.Tags, "content": row.Content,
		"priority": row.Priority, "is_pinned": row.IsPinned, "supersedes_public_id": row.SupersedesPublicID,
		"status": storytellerModel.AssistantMemoryStatusConfirmed, "confirmed_at": &confirmedAt, "error_message": nil,
	}
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

// ExpireAssistantMemoryDrafts 先依專案慣例 soft delete 逾期草稿，讓所有刪除
// 路徑都有可追查的 deleted_at，不會因排程直接略過生命週期。
func (r *Repository) ExpireAssistantMemoryDrafts(updatedBefore, deletedAt time.Time) (int64, error) {
	result := r.db.Model(&storytellerModel.AssistantMemory{}).
		Where("status != ? AND is_deleted = 0 AND updated_at < ?", storytellerModel.AssistantMemoryStatusConfirmed, updatedBefore).
		Updates(map[string]interface{}{"is_deleted": true, "deleted_at": &deletedAt})
	return result.RowsAffected, result.Error
}

// PurgeDeletedAssistantMemoryDrafts 只實體清除已經過 soft delete 保留期、且從未
// confirmed 的暫存草稿。一般記憶及剛刪除的草稿不會進入這個維護路徑。
func (r *Repository) PurgeDeletedAssistantMemoryDrafts(deletedBefore time.Time) (int64, error) {
	result := r.db.Unscoped().
		Where("status != ? AND is_deleted = 1 AND deleted_at IS NOT NULL AND deleted_at < ?", storytellerModel.AssistantMemoryStatusConfirmed, deletedBefore).
		Delete(&storytellerModel.AssistantMemory{})
	return result.RowsAffected, result.Error
}

func nullableString(value string) interface{} {
	value = strings.TrimSpace(value)
	if value == "" {
		return nil
	}
	return value
}

func escapeAssistantMemoryLike(value string) string {
	return strings.NewReplacer("!", "!!", "%", "!%", "_", "!_").Replace(value)
}
