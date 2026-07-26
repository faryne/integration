package storyteller

import (
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/model/enum"
	"faryne.dev/service/client"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Repository struct{ db *gorm.DB }

func NewRepository() *Repository {
	return &Repository{db: client.GetDB(enum.DBWalolita)}
}

func (r *Repository) PublicProjects() ([]storytellerModel.Project, error) {
	rows := make([]storytellerModel.Project, 0)
	err := r.db.Where("visibility = ? AND deleted_at IS NULL", storytellerModel.ProjectVisibilityPublic).
		Order("updated_at DESC, id DESC").
		Find(&rows).Error
	return rows, err
}

func (r *Repository) Projects(userID uint64) ([]storytellerModel.Project, error) {
	rows := make([]storytellerModel.Project, 0)
	err := r.db.Where("user_id = ? AND deleted_at IS NULL", userID).
		Order("updated_at DESC, id DESC").
		Find(&rows).Error
	return rows, err
}

func (r *Repository) ProjectByPublicID(publicID string) (*storytellerModel.Project, error) {
	var row storytellerModel.Project
	err := r.db.Where("public_id = ? AND visibility = ? AND deleted_at IS NULL", publicID, storytellerModel.ProjectVisibilityPublic).
		First(&row).Error
	return &row, err
}

func (r *Repository) ProjectByShareToken(token string) (*storytellerModel.Project, error) {
	var row storytellerModel.Project
	err := r.db.Where("share_token = ? AND visibility = ? AND deleted_at IS NULL", token, storytellerModel.ProjectVisibilityUnlisted).
		First(&row).Error
	return &row, err
}

func (r *Repository) ProjectByPublicIDForFavorite(publicID string) (*storytellerModel.Project, error) {
	var row storytellerModel.Project
	err := r.db.Where(
		"public_id = ? AND visibility IN ? AND deleted_at IS NULL",
		publicID,
		[]storytellerModel.ProjectVisibility{
			storytellerModel.ProjectVisibilityPublic,
			storytellerModel.ProjectVisibilityUnlisted,
		},
	).First(&row).Error
	return &row, err
}

func (r *Repository) ProjectByPublicIDForUser(userID uint64, publicID string) (*storytellerModel.Project, error) {
	var row storytellerModel.Project
	err := r.db.Where("user_id = ? AND public_id = ? AND deleted_at IS NULL", userID, publicID).
		First(&row).Error
	return &row, err
}

func (r *Repository) CreateProject(row *storytellerModel.Project) error {
	return r.db.Create(row).Error
}

func (r *Repository) ProjectSlugTaken(userID uint64, slug string, excludeProjectID uint64) (bool, error) {
	var count int64
	err := r.db.
		Table("storyteller_projects").
		Where("user_id = ? AND slug = ? AND id != ?", userID, slug, excludeProjectID).
		Count(&count).Error
	return count > 0, err
}

func (r *Repository) UpdateProject(row *storytellerModel.Project) error {
	return r.db.Save(row).Error
}

func (r *Repository) DeleteProject(row *storytellerModel.Project) error {
	now := time.Now()
	return r.db.Model(row).Updates(map[string]any{"deleted_at": &now}).Error
}

func (r *Repository) Agents(userID uint64) ([]storytellerModel.Agent, error) {
	rows := make([]storytellerModel.Agent, 0)
	err := r.db.Where("user_id = ? AND is_deleted = 0 AND deleted_at IS NULL", userID).
		Order("updated_at DESC, id DESC").
		Find(&rows).Error
	return rows, err
}

func (r *Repository) Agent(userID, id uint64) (*storytellerModel.Agent, error) {
	var row storytellerModel.Agent
	err := r.db.Where("user_id = ? AND id = ? AND is_deleted = 0 AND deleted_at IS NULL", userID, id).
		First(&row).Error
	return &row, err
}

func (r *Repository) ProviderAPIKeys(userID uint64) ([]storytellerModel.ProviderAPIKey, error) {
	rows := make([]storytellerModel.ProviderAPIKey, 0)
	err := r.db.Where("user_id = ? AND is_deleted = 0 AND deleted_at IS NULL", userID).
		Order("provider ASC, updated_at DESC, id DESC").
		Find(&rows).Error
	return rows, err
}

func (r *Repository) ProviderAPIKey(userID, id uint64) (*storytellerModel.ProviderAPIKey, error) {
	var row storytellerModel.ProviderAPIKey
	err := r.db.Where("user_id = ? AND id = ? AND is_deleted = 0 AND deleted_at IS NULL", userID, id).
		First(&row).Error
	return &row, err
}

func (r *Repository) CreateProviderAPIKey(row *storytellerModel.ProviderAPIKey) error {
	return r.db.Create(row).Error
}

func (r *Repository) DeleteProviderAPIKey(row *storytellerModel.ProviderAPIKey) error {
	now := time.Now()
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(row).Updates(map[string]any{"is_deleted": true, "deleted_at": &now}).Error; err != nil {
			return err
		}
		return tx.Model(&storytellerModel.Agent{}).
			Where("provider_apikey_id = ?", row.ID).
			Update("provider_apikey_id", nil).Error
	})
}

func (r *Repository) ActiveProviderAPIKeysForRotation() ([]storytellerModel.ProviderAPIKey, error) {
	rows := make([]storytellerModel.ProviderAPIKey, 0)
	err := r.db.Where("is_deleted = 0 AND deleted_at IS NULL").
		Order("id ASC").
		Find(&rows).Error
	return rows, err
}

func (r *Repository) UpdateProviderAPIKeyEncryption(row *storytellerModel.ProviderAPIKey) error {
	return r.db.Model(row).Updates(map[string]any{
		"api_key_encrypted": row.APIKeyEncrypted,
		"api_key_data_key":  row.APIKeyDataKey,
		"api_key_key_id":    row.APIKeyKeyID,
	}).Error
}

func (r *Repository) UpdateProviderAPIKeyTestResult(row *storytellerModel.ProviderAPIKey) error {
	return r.db.Model(row).Updates(map[string]any{
		"last_tested_at": row.LastTestedAt,
		"last_test_ok":   row.LastTestOK,
	}).Error
}

func (r *Repository) UpdateProviderAPIKey(row *storytellerModel.ProviderAPIKey) error {
	return r.db.Model(row).Updates(map[string]any{
		"label":             row.Label,
		"endpoint":          row.Endpoint,
		"api_key_encrypted": row.APIKeyEncrypted,
		"api_key_data_key":  row.APIKeyDataKey,
		"api_key_key_id":    row.APIKeyKeyID,
		"last_tested_at":    row.LastTestedAt,
		"last_test_ok":      row.LastTestOK,
	}).Error
}

func (r *Repository) AgentProviderModels() ([]storytellerModel.AgentProviderModels, error) {
	providers := make([]storytellerModel.AgentProviderSetting, 0)
	if err := r.db.Where("is_deleted = 0 AND deleted_at IS NULL").
		Order("sort ASC, id ASC").
		Find(&providers).Error; err != nil {
		return nil, err
	}
	if len(providers) == 0 {
		return []storytellerModel.AgentProviderModels{}, nil
	}
	providerIDs := make([]uint64, 0, len(providers))
	for _, provider := range providers {
		providerIDs = append(providerIDs, provider.ID)
	}
	models := make([]storytellerModel.AgentModel, 0)
	if err := r.db.Where("provider_id IN ? AND is_deleted = 0 AND deleted_at IS NULL", providerIDs).
		Order("provider_id ASC, sort ASC, id ASC").
		Find(&models).Error; err != nil {
		return nil, err
	}
	modelsByProviderID := make(map[uint64][]storytellerModel.AgentModelOption)
	for _, model := range models {
		modelsByProviderID[model.ProviderID] = append(modelsByProviderID[model.ProviderID], storytellerModel.AgentModelOption{
			ID:          model.ID,
			Name:        model.Name,
			Label:       model.Label,
			Description: model.Description,
			Price:       model.Price,
		})
	}
	output := make([]storytellerModel.AgentProviderModels, 0, len(providers))
	for _, provider := range providers {
		providerModels := modelsByProviderID[provider.ID]
		if providerModels == nil {
			providerModels = []storytellerModel.AgentModelOption{}
		}
		output = append(output, storytellerModel.AgentProviderModels{
			Provider:         provider.Provider,
			Label:            provider.Label,
			Models:           providerModels,
			AllowCustomModel: provider.AllowCustomModel,
		})
	}
	return output, nil
}

func (r *Repository) AgentProviderModel(provider storytellerModel.AgentProvider, modelName string) (*storytellerModel.AgentProviderModels, error) {
	var providerRow storytellerModel.AgentProviderSetting
	if err := r.db.Where("provider = ? AND is_deleted = 0 AND deleted_at IS NULL", provider).
		First(&providerRow).Error; err != nil {
		return nil, err
	}
	output := &storytellerModel.AgentProviderModels{
		Provider:         providerRow.Provider,
		Label:            providerRow.Label,
		AllowCustomModel: providerRow.AllowCustomModel,
	}
	var model storytellerModel.AgentModel
	if err := r.db.Where("provider_id = ? AND name = ? AND is_deleted = 0 AND deleted_at IS NULL", providerRow.ID, modelName).
		First(&model).Error; err != nil {
		if providerRow.AllowCustomModel {
			return output, nil
		}
		return nil, err
	}
	output.Models = []storytellerModel.AgentModelOption{{
		ID:          model.ID,
		Name:        model.Name,
		Label:       model.Label,
		Description: model.Description,
		Price:       model.Price,
	}}
	return output, nil
}

func (r *Repository) SyncAgentModels(provider storytellerModel.AgentProvider, models []storytellerModel.AgentModelSyncInput) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var providerRow storytellerModel.AgentProviderSetting
		if err := tx.Where("provider = ? AND is_deleted = 0 AND deleted_at IS NULL", provider).
			First(&providerRow).Error; err != nil {
			return err
		}

		modelNames := make([]string, 0, len(models))
		for _, model := range models {
			row := storytellerModel.AgentModel{
				ProviderID:  providerRow.ID,
				Name:        model.Name,
				Label:       model.Label,
				Description: model.Description,
				Price:       model.Price,
				Sort:        model.Sort,
				IsDeleted:   false,
				DeletedAt:   nil,
			}
			if err := tx.Clauses(clause.OnConflict{
				Columns: []clause.Column{
					{Name: "provider_id"},
					{Name: "name"},
				},
				DoUpdates: clause.AssignmentColumns([]string{
					"label",
					"description",
					"price",
					"sort",
					"is_deleted",
					"deleted_at",
					"updated_at",
				}),
			}).Create(&row).Error; err != nil {
				return err
			}
			modelNames = append(modelNames, model.Name)
		}

		query := tx.Model(&storytellerModel.AgentModel{}).
			Where("provider_id = ? AND is_deleted = 0", providerRow.ID)
		if len(modelNames) > 0 {
			query = query.Where("name NOT IN ?", modelNames)
		}
		now := time.Now()
		return query.Updates(map[string]any{
			"is_deleted": true,
			"deleted_at": &now,
		}).Error
	})
}

func (r *Repository) CreateAgent(row *storytellerModel.Agent) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(row).Error; err != nil {
			return err
		}
		return tx.Create(agentPromptVersionFromAgent(row)).Error
	})
}

func (r *Repository) UpdateAgent(row *storytellerModel.Agent) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(row).Error; err != nil {
			return err
		}
		return tx.Create(agentPromptVersionFromAgent(row)).Error
	})
}

func (r *Repository) DeleteAgent(row *storytellerModel.Agent) error {
	now := time.Now()
	return r.db.Model(row).Updates(map[string]any{"is_deleted": true, "deleted_at": &now}).Error
}

func (r *Repository) AgentPromptVersions(agentID uint64) ([]storytellerModel.AgentPromptVersion, error) {
	rows := make([]storytellerModel.AgentPromptVersion, 0)
	err := r.db.Where("agent_id = ? AND deleted_at IS NULL", agentID).
		Order("created_at DESC, id DESC").
		Find(&rows).Error
	return rows, err
}

func (r *Repository) AgentPromptVersion(agentID, versionID uint64) (*storytellerModel.AgentPromptVersion, error) {
	var row storytellerModel.AgentPromptVersion
	err := r.db.Where("agent_id = ? AND id = ? AND deleted_at IS NULL", agentID, versionID).
		First(&row).Error
	return &row, err
}

func agentPromptVersionFromAgent(agent *storytellerModel.Agent) *storytellerModel.AgentPromptVersion {
	return &storytellerModel.AgentPromptVersion{
		AgentID:       agent.ID,
		Name:          agent.Name,
		Provider:      agent.Provider,
		ModelName:     agent.ModelName,
		DefaultPrompt: agent.DefaultPrompt,
	}
}

// Stories 只回傳一般故事（is_volume = 0），冊不會混在這份列表裡——所有既有呼叫端
// （字數統計、故事列表、MCP 回傳）因此不用改判斷邏輯。要拿冊列表請用 Volumes。
func (r *Repository) Stories(projectID uint64) ([]storytellerModel.Story, error) {
	rows := make([]storytellerModel.Story, 0)
	err := r.db.Where("project_id = ? AND is_volume = 0 AND is_deleted = 0 AND deleted_at IS NULL", projectID).
		Order("sort ASC, id ASC").
		Find(&rows).Error
	return rows, err
}

// StoriesPage 是 Stories 的分頁版本，給 MCP 這種需要控制單次回應大小的呼叫端用；
// 網頁前端一次要拿全部，繼續呼叫不分頁的 Stories，不要互相取代。
func (r *Repository) StoriesPage(projectID uint64, offset, limit int) ([]storytellerModel.Story, int64, error) {
	var total int64
	if err := r.db.Model(&storytellerModel.Story{}).
		Where("project_id = ? AND is_volume = 0 AND is_deleted = 0 AND deleted_at IS NULL", projectID).
		Count(&total).Error; err != nil {
		return nil, 0, err
	}
	rows := make([]storytellerModel.Story, 0)
	err := r.db.Where("project_id = ? AND is_volume = 0 AND is_deleted = 0 AND deleted_at IS NULL", projectID).
		Order("sort ASC, id ASC").
		Offset(offset).Limit(limit).
		Find(&rows).Error
	return rows, total, err
}

func (r *Repository) PublishedStories(projectID uint64) ([]storytellerModel.Story, error) {
	rows := make([]storytellerModel.Story, 0)
	err := r.db.Where("project_id = ? AND status = ? AND is_volume = 0 AND is_deleted = 0 AND deleted_at IS NULL", projectID, storytellerModel.StoryStatusCompleted).
		Order("sort ASC, id ASC").
		Find(&rows).Error
	return rows, err
}

// Volumes 回傳一個專案底下的冊列表（is_volume = 1），跟 Stories 分開拿。
func (r *Repository) Volumes(projectID uint64) ([]storytellerModel.Story, error) {
	rows := make([]storytellerModel.Story, 0)
	err := r.db.Where("project_id = ? AND is_volume = 1 AND is_deleted = 0 AND deleted_at IS NULL", projectID).
		Order("sort ASC, id ASC").
		Find(&rows).Error
	return rows, err
}

// VolumeChildrenCount 給刪除冊時的非空檢查用。
func (r *Repository) VolumeChildrenCount(volumeID uint64) (int64, error) {
	var count int64
	err := r.db.Model(&storytellerModel.Story{}).
		Where("parent_id = ? AND is_deleted = 0 AND deleted_at IS NULL", volumeID).
		Count(&count).Error
	return count, err
}

func (r *Repository) Story(projectID uint64, publicID string) (*storytellerModel.Story, error) {
	var row storytellerModel.Story
	err := r.db.Where("project_id = ? AND public_id = ? AND is_deleted = 0 AND deleted_at IS NULL", projectID, publicID).
		First(&row).Error
	return &row, err
}

func (r *Repository) StoryVersions(storyID uint64) ([]storytellerModel.StoryVersion, error) {
	rows := make([]storytellerModel.StoryVersion, 0)
	err := r.db.Where("story_id = ? AND deleted_at IS NULL", storyID).
		Order("created_at DESC, id DESC").
		Find(&rows).Error
	return rows, err
}

func (r *Repository) StoryVersion(storyID, versionID uint64) (*storytellerModel.StoryVersion, error) {
	var row storytellerModel.StoryVersion
	err := r.db.Where("story_id = ? AND id = ? AND deleted_at IS NULL", storyID, versionID).
		First(&row).Error
	return &row, err
}

func (r *Repository) LatestStoryVersion(storyID uint64) (*storytellerModel.StoryVersion, error) {
	var row storytellerModel.StoryVersion
	err := r.db.Where("story_id = ? AND deleted_at IS NULL", storyID).
		Order("created_at DESC, id DESC").
		First(&row).Error
	return &row, err
}

func (r *Repository) PublishedStory(projectID uint64, publicID string) (*storytellerModel.Story, error) {
	var row storytellerModel.Story
	err := r.db.Where(
		"project_id = ? AND public_id = ? AND status = ? AND is_deleted = 0 AND deleted_at IS NULL",
		projectID, publicID, storytellerModel.StoryStatusCompleted,
	).First(&row).Error
	return &row, err
}

// StoryVolumeEvents 回傳一冊的隸屬異動時間軸：這一冊被搬入／搬出／新增/刪除的所有紀錄，
// 同一筆紀錄只要跟這個冊有關（不論是來源冊還是目標冊）都會出現。
func (r *Repository) StoryVolumeEvents(volumeID uint64) ([]storytellerModel.StoryVolumeEventOutput, error) {
	rows := make([]storytellerModel.StoryVolumeEventOutput, 0)
	err := r.db.
		Table("storyteller_story_volume_events AS events").
		Joins("INNER JOIN storyteller_stories AS stories ON stories.id = events.story_id").
		Where("events.from_volume_id = ? OR events.to_volume_id = ?", volumeID, volumeID).
		Select(`events.id,
			events.story_id,
			stories.public_id AS story_public_id,
			stories.title AS story_title,
			events.from_volume_id,
			events.to_volume_id,
			events.created_at`).
		Order("events.created_at DESC, events.id DESC").
		Find(&rows).Error
	return rows, err
}

// ChildStoryVersions 是「內容變動」歷史的衍生查詢：直接 join 目前 parent_id 屬於這一冊的
// 故事的版本記錄，不需要另外維護資料表。
func (r *Repository) ChildStoryVersions(volumeID uint64) ([]storytellerModel.StoryVersion, error) {
	rows := make([]storytellerModel.StoryVersion, 0)
	err := r.db.
		Table("storyteller_story_versions AS versions").
		Joins("INNER JOIN storyteller_stories AS stories ON stories.id = versions.story_id").
		Where("stories.parent_id = ? AND stories.is_deleted = 0 AND stories.deleted_at IS NULL AND versions.deleted_at IS NULL", volumeID).
		Select("versions.*").
		Order("versions.created_at DESC, versions.id DESC").
		Find(&rows).Error
	return rows, err
}

func (r *Repository) StoryBookmarks(userID, storyID uint64) ([]storytellerModel.StoryBookmark, error) {
	rows := make([]storytellerModel.StoryBookmark, 0)
	err := r.db.
		Where("user_id = ? AND story_id = ?", userID, storyID).
		Order("story_version_id DESC, line_index ASC").
		Find(&rows).Error
	return rows, err
}

func (r *Repository) ProjectStoryBookmarks(userID, projectID uint64) ([]storytellerModel.StoryBookmarkOutput, error) {
	rows := make([]storytellerModel.StoryBookmarkOutput, 0)
	err := r.db.
		Table("storyteller_story_bookmarks AS bookmarks").
		Joins("INNER JOIN storyteller_stories AS stories ON stories.id = bookmarks.story_id").
		Joins("INNER JOIN storyteller_story_versions AS versions ON versions.id = bookmarks.story_version_id").
		Where("bookmarks.user_id = ? AND stories.project_id = ? AND stories.is_deleted = 0 AND stories.deleted_at IS NULL", userID, projectID).
		Select(`bookmarks.id,
			bookmarks.story_id,
			stories.public_id AS story_public_id,
			stories.title AS story_title,
			bookmarks.story_version_id,
			bookmarks.line_index,
			bookmarks.created_at,
			(SELECT v.id FROM storyteller_story_versions AS v
				WHERE v.story_id = bookmarks.story_id AND v.deleted_at IS NULL
				ORDER BY v.created_at DESC, v.id DESC LIMIT 1) AS latest_story_version_id,
			TRIM(SUBSTRING_INDEX(SUBSTRING_INDEX(versions.content, '\n', bookmarks.line_index + 1), '\n', -1)) AS line_preview`).
		Order("bookmarks.created_at DESC, bookmarks.id DESC").
		Find(&rows).Error
	return rows, err
}

func (r *Repository) StoryBookmark(userID, versionID uint64, lineIndex int) (*storytellerModel.StoryBookmark, error) {
	var row storytellerModel.StoryBookmark
	err := r.db.
		Where("user_id = ? AND story_version_id = ? AND line_index = ?", userID, versionID, lineIndex).
		First(&row).Error
	return &row, err
}

func (r *Repository) CreateStoryBookmark(row *storytellerModel.StoryBookmark) error {
	return r.db.Create(row).Error
}

func (r *Repository) DeleteStoryBookmark(userID, versionID uint64, lineIndex int) error {
	return r.db.
		Where("user_id = ? AND story_version_id = ? AND line_index = ?", userID, versionID, lineIndex).
		Delete(&storytellerModel.StoryBookmark{}).Error
}

func (r *Repository) Lores(projectID uint64) ([]storytellerModel.Lore, error) {
	rows := make([]storytellerModel.Lore, 0)
	err := r.db.Where("project_id = ? AND is_deleted = 0 AND deleted_at IS NULL", projectID).
		Order("updated_at DESC, id DESC").
		Find(&rows).Error
	return rows, err
}

// LoresPage 是 Lores 的分頁版本，語意跟 StoriesPage 一樣。
func (r *Repository) LoresPage(projectID uint64, offset, limit int) ([]storytellerModel.Lore, int64, error) {
	var total int64
	if err := r.db.Model(&storytellerModel.Lore{}).
		Where("project_id = ? AND is_deleted = 0 AND deleted_at IS NULL", projectID).
		Count(&total).Error; err != nil {
		return nil, 0, err
	}
	rows := make([]storytellerModel.Lore, 0)
	err := r.db.Where("project_id = ? AND is_deleted = 0 AND deleted_at IS NULL", projectID).
		Order("updated_at DESC, id DESC").
		Offset(offset).Limit(limit).
		Find(&rows).Error
	return rows, total, err
}

func (r *Repository) Lore(projectID uint64, publicID string) (*storytellerModel.Lore, error) {
	var row storytellerModel.Lore
	err := r.db.Where("project_id = ? AND public_id = ? AND is_deleted = 0 AND deleted_at IS NULL", projectID, publicID).
		First(&row).Error
	return &row, err
}

func (r *Repository) LoreVersions(loreID uint64) ([]storytellerModel.LoreVersion, error) {
	rows := make([]storytellerModel.LoreVersion, 0)
	err := r.db.Where("lore_id = ? AND deleted_at IS NULL", loreID).
		Order("created_at DESC, id DESC").
		Find(&rows).Error
	return rows, err
}

func (r *Repository) LoreVersion(loreID, versionID uint64) (*storytellerModel.LoreVersion, error) {
	var row storytellerModel.LoreVersion
	err := r.db.Where("lore_id = ? AND id = ? AND deleted_at IS NULL", loreID, versionID).
		First(&row).Error
	return &row, err
}

func (r *Repository) CreateStoryChatWithMessages(chat *storytellerModel.StoryChat, messages []storytellerModel.StoryChatMessage, usage *storytellerModel.AgentUsageLog) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(chat).Error; err != nil {
			return err
		}
		for i := range messages {
			messages[i].ChatID = chat.ID
		}
		if err := tx.Create(&messages).Error; err != nil {
			return err
		}
		if usage == nil {
			return nil
		}
		usage.ChatID = chat.ID
		return tx.Create(usage).Error
	})
}

func (r *Repository) AgentUsageSummary(userID uint64, from, to time.Time) ([]storytellerModel.AgentUsageSummaryRow, error) {
	rows := make([]storytellerModel.AgentUsageSummaryRow, 0)
	err := r.db.Table("storyteller_agent_usage_logs AS logs").
		Select(`logs.provider_apikey_id,
			logs.provider,
			apikeys.label AS provider_apikey_label,
			logs.agent_id,
			agents.name AS agent_name,
			logs.model_name,
			SUM(logs.input_tokens) AS input_tokens,
			SUM(logs.output_tokens) AS output_tokens,
			SUM(logs.total_tokens) AS total_tokens,
			COUNT(*) AS run_count`).
		// "keys" 是 MySQL 保留字，當別名會造成語法錯誤，改用 apikeys
		Joins("LEFT JOIN storyteller_provider_apikeys AS apikeys ON apikeys.id = logs.provider_apikey_id").
		Joins("LEFT JOIN storyteller_agents AS agents ON agents.id = logs.agent_id").
		Where("logs.user_id = ? AND logs.created_at >= ? AND logs.created_at < ?", userID, from, to).
		Group("logs.provider_apikey_id, logs.provider, apikeys.label, logs.agent_id, agents.name, logs.model_name").
		Order("logs.provider_apikey_id ASC, logs.agent_id ASC").
		Scan(&rows).Error
	return rows, err
}

func (r *Repository) AgentUsageLogs(userID, providerAPIKeyID, agentID uint64, from, to time.Time, offset, limit int) ([]storytellerModel.AgentUsageLogRow, int64, error) {
	base := r.db.Table("storyteller_agent_usage_logs AS logs").
		Joins("LEFT JOIN storyteller_story_chats AS chats ON chats.id = logs.chat_id").
		Joins("LEFT JOIN storyteller_stories AS stories ON stories.id = chats.story_id").
		Joins("LEFT JOIN storyteller_lores AS lores ON lores.id = chats.lore_id").
		Where(
			"logs.user_id = ? AND logs.provider_apikey_id = ? AND logs.agent_id = ? AND logs.created_at >= ? AND logs.created_at < ?",
			userID, providerAPIKeyID, agentID, from, to,
		)

	var total int64
	if err := base.Session(&gorm.Session{}).Count(&total).Error; err != nil {
		return nil, 0, err
	}

	rows := make([]storytellerModel.AgentUsageLogRow, 0)
	err := base.Session(&gorm.Session{}).
		Select(`logs.id,
			logs.created_at,
			logs.model_name,
			logs.input_tokens,
			logs.output_tokens,
			logs.total_tokens,
			stories.title AS story_title,
			lores.title AS lore_title`).
		Order("logs.created_at DESC, logs.id DESC").
		Offset(offset).
		Limit(limit).
		Scan(&rows).Error
	return rows, total, err
}

func (r *Repository) StoryChatMessages(storyID uint64, offset, limit int) ([]storytellerModel.StoryChatMessageOutput, int64, error) {
	rows := make([]storytellerModel.StoryChatMessageOutput, 0)
	query := r.db.
		Table("storyteller_story_chat_messages AS messages").
		Joins("INNER JOIN storyteller_story_chats AS chats ON chats.id = messages.chat_id").
		Joins("INNER JOIN storyteller_agents AS agents ON agents.id = COALESCE(messages.agent_id, chats.agent_id)").
		Where("chats.story_id = ? AND messages.deleted_at IS NULL", storyID)
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := query.
		Select(`messages.id,
			messages.chat_id,
			messages.role,
			messages.content,
			messages.metadata,
			messages.created_at,
			messages.updated_at,
			COALESCE(messages.agent_id, chats.agent_id) AS agent_id,
			agents.name AS agent_name`).
		Order("messages.created_at DESC, messages.id DESC").
		Offset(offset).
		Limit(limit).
		Find(&rows).Error
	for i, j := 0, len(rows)-1; i < j; i, j = i+1, j-1 {
		rows[i], rows[j] = rows[j], rows[i]
	}
	return rows, total, err
}

func (r *Repository) LoreChatMessages(loreID uint64, offset, limit int) ([]storytellerModel.StoryChatMessageOutput, int64, error) {
	rows := make([]storytellerModel.StoryChatMessageOutput, 0)
	query := r.db.
		Table("storyteller_story_chat_messages AS messages").
		Joins("INNER JOIN storyteller_story_chats AS chats ON chats.id = messages.chat_id").
		Joins("INNER JOIN storyteller_agents AS agents ON agents.id = COALESCE(messages.agent_id, chats.agent_id)").
		Where("chats.lore_id = ? AND messages.deleted_at IS NULL", loreID)
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := query.
		Select(`messages.id,
			messages.chat_id,
			messages.role,
			messages.content,
			messages.metadata,
			messages.created_at,
			messages.updated_at,
			COALESCE(messages.agent_id, chats.agent_id) AS agent_id,
			agents.name AS agent_name`).
		Order("messages.created_at DESC, messages.id DESC").
		Offset(offset).
		Limit(limit).
		Find(&rows).Error
	for i, j := 0, len(rows)-1; i < j; i, j = i+1, j-1 {
		rows[i], rows[j] = rows[j], rows[i]
	}
	return rows, total, err
}

// CreateStoryWithVersion 存檔並塞入第一筆版本。volumeEvent 非 nil 時（建立時直接指定
// 冊），在同一個 transaction 裡一併寫入冊隸屬異動記錄，跟故事存檔綁在一起、失敗就一起回滾。
func (r *Repository) CreateStoryWithVersion(story *storytellerModel.Story, version *storytellerModel.StoryVersion, volumeEvent *storytellerModel.StoryVolumeEvent) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(story).Error; err != nil {
			return err
		}
		version.StoryID = story.ID
		if err := tx.Create(version).Error; err != nil {
			return err
		}
		story.LatestVersionID = &version.ID
		if err := tx.Model(story).Update("latest_version_id", version.ID).Error; err != nil {
			return err
		}
		if volumeEvent != nil {
			volumeEvent.StoryID = story.ID
			return tx.Create(volumeEvent).Error
		}
		return nil
	})
}

// UpdateStoryWithVersion 存檔並塞入新版本，永遠會寫入（不會因為版本衝突拒絕寫入）。
// baseVersionID 非 nil 時，會在同一個 transaction 裡鎖住這篇故事目前最新的版本列
// 一併檢查，如果跟呼叫端帶來的 baseVersionID 對不上，把當時真正最新的版本 id 記到
// 新版本的 ConflictedWithVersionID 上並回傳 conflicted=true，內容一樣照常存成新版本，
// 不會被拒絕或蓋掉。volumeEvent 非 nil 時（parent_id 有變化），一併寫入冊隸屬異動記錄。
func (r *Repository) UpdateStoryWithVersion(story *storytellerModel.Story, version *storytellerModel.StoryVersion, baseVersionID *uint64, volumeEvent *storytellerModel.StoryVolumeEvent) (conflicted bool, err error) {
	err = r.db.Transaction(func(tx *gorm.DB) error {
		if baseVersionID != nil {
			var latest storytellerModel.StoryVersion
			err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
				Where("story_id = ? AND deleted_at IS NULL", story.ID).
				Order("created_at DESC, id DESC").
				First(&latest).Error
			if err != nil {
				return err
			}
			if latest.ID != *baseVersionID {
				conflicted = true
				version.ConflictedWithVersionID = &latest.ID
			}
		}
		version.StoryID = story.ID
		if err := tx.Create(version).Error; err != nil {
			return err
		}
		story.LatestVersionID = &version.ID
		if err := tx.Save(story).Error; err != nil {
			return err
		}
		if volumeEvent != nil {
			volumeEvent.StoryID = story.ID
			return tx.Create(volumeEvent).Error
		}
		return nil
	})
	return conflicted, err
}

// DeleteStory 軟刪除故事。volumeEvent 非 nil 時（被刪除的故事當下有 parent_id），
// 在同一個 transaction 裡一併補寫一筆 to_volume_id=NULL 的冊隸屬異動記錄，
// 否則冊被刪掉一篇故事後，時間軸上會完全看不出這篇曾經存在過。
func (r *Repository) DeleteStory(row *storytellerModel.Story, volumeEvent *storytellerModel.StoryVolumeEvent) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		now := time.Now()
		if err := tx.Model(row).Updates(map[string]any{"is_deleted": true, "deleted_at": &now}).Error; err != nil {
			return err
		}
		if volumeEvent != nil {
			volumeEvent.StoryID = row.ID
			return tx.Create(volumeEvent).Error
		}
		return nil
	})
}

func (r *Repository) CreateLoreWithVersion(lore *storytellerModel.Lore, version *storytellerModel.LoreVersion) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(lore).Error; err != nil {
			return err
		}
		version.LoreID = lore.ID
		if err := tx.Create(version).Error; err != nil {
			return err
		}
		lore.LatestVersionID = &version.ID
		return tx.Model(lore).Update("latest_version_id", version.ID).Error
	})
}

// UpdateLoreWithVersion 存檔並塞入新版本，baseVersionID 的併發檢查邏輯跟
// UpdateStoryWithVersion 一樣：只記錄 ConflictedWithVersionID／回報 conflicted，永遠照常寫入。
func (r *Repository) UpdateLoreWithVersion(lore *storytellerModel.Lore, version *storytellerModel.LoreVersion, baseVersionID *uint64) (conflicted bool, err error) {
	err = r.db.Transaction(func(tx *gorm.DB) error {
		if baseVersionID != nil {
			var latest storytellerModel.LoreVersion
			err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
				Where("lore_id = ? AND deleted_at IS NULL", lore.ID).
				Order("created_at DESC, id DESC").
				First(&latest).Error
			if err != nil {
				return err
			}
			if latest.ID != *baseVersionID {
				conflicted = true
				version.ConflictedWithVersionID = &latest.ID
			}
		}
		version.LoreID = lore.ID
		if err := tx.Create(version).Error; err != nil {
			return err
		}
		lore.LatestVersionID = &version.ID
		return tx.Save(lore).Error
	})
	return conflicted, err
}

func (r *Repository) DeleteLore(row *storytellerModel.Lore) error {
	now := time.Now()
	return r.db.Model(row).Updates(map[string]any{"is_deleted": true, "deleted_at": &now}).Error
}

func (r *Repository) FavoriteProjects(userID uint64) ([]storytellerModel.Project, error) {
	rows := make([]storytellerModel.Project, 0)
	err := r.db.
		Table("storyteller_projects").
		Select("storyteller_projects.*").
		Joins("INNER JOIN storyteller_project_rankings ON storyteller_project_rankings.project_id = storyteller_projects.id").
		Where("storyteller_project_rankings.user_id = ? AND storyteller_project_rankings.deleted_at IS NULL", userID).
		Where("storyteller_project_rankings.is_favorite = 1").
		Where("storyteller_projects.deleted_at IS NULL").
		Order("storyteller_project_rankings.updated_at DESC, storyteller_project_rankings.id DESC").
		Find(&rows).Error
	return rows, err
}

func (r *Repository) FavoriteAuthors(userID uint64) ([]storytellerModel.AuthorFavorite, error) {
	rows := make([]storytellerModel.AuthorFavorite, 0)
	err := r.db.
		Where("user_id = ? AND deleted_at IS NULL", userID).
		Order("updated_at DESC, id DESC").
		Find(&rows).Error
	return rows, err
}

func (r *Repository) AuthorFavorite(userID, authorUserID uint64) (*storytellerModel.AuthorFavorite, error) {
	var row storytellerModel.AuthorFavorite
	err := r.db.Unscoped().
		Where("user_id = ? AND author_user_id = ?", userID, authorUserID).
		First(&row).Error
	return &row, err
}

func (r *Repository) CreateAuthorFavorite(row *storytellerModel.AuthorFavorite) error {
	return r.db.Create(row).Error
}

func (r *Repository) SaveAuthorFavorite(row *storytellerModel.AuthorFavorite) error {
	return r.db.Save(row).Error
}

func (r *Repository) PublicAuthorSummary(userID uint64) (uint64, uint64, uint64, uint64, uint64, float64, error) {
	var projectCount int64
	if err := r.db.
		Table("storyteller_projects").
		Where("user_id = ? AND visibility = ? AND deleted_at IS NULL", userID, storytellerModel.ProjectVisibilityPublic).
		Count(&projectCount).Error; err != nil {
		return 0, 0, 0, 0, 0, 0, err
	}
	type storyResult struct {
		StoryCount uint64
		WordCount  uint64
	}
	var stories storyResult
	if err := r.db.
		Table("storyteller_projects AS projects").
		Select("COUNT(stories.id) AS story_count, COALESCE(SUM(stories.word_count), 0) AS word_count").
		Joins("INNER JOIN storyteller_stories AS stories ON stories.project_id = projects.id AND stories.status = ? AND stories.is_deleted = 0 AND stories.deleted_at IS NULL", storytellerModel.StoryStatusCompleted).
		Where("projects.user_id = ? AND projects.visibility = ? AND projects.deleted_at IS NULL", userID, storytellerModel.ProjectVisibilityPublic).
		Scan(&stories).Error; err != nil {
		return 0, 0, 0, 0, 0, 0, err
	}
	type rankingResult struct {
		RatingCount   uint64
		AverageRating float64
	}
	var rankings rankingResult
	if err := r.db.
		Table("storyteller_projects AS projects").
		Select("COUNT(rankings.ranking) AS rating_count, COALESCE(AVG(rankings.ranking), 0) AS average_rating").
		Joins("INNER JOIN storyteller_project_rankings AS rankings ON rankings.project_id = projects.id AND rankings.ranking IS NOT NULL AND rankings.deleted_at IS NULL").
		Where("projects.user_id = ? AND projects.visibility = ? AND projects.deleted_at IS NULL", userID, storytellerModel.ProjectVisibilityPublic).
		Scan(&rankings).Error; err != nil {
		return 0, 0, 0, 0, 0, 0, err
	}
	var followerCount int64
	if err := r.db.
		Table("storyteller_author_favorites").
		Where("author_user_id = ? AND deleted_at IS NULL", userID).
		Count(&followerCount).Error; err != nil {
		return 0, 0, 0, 0, 0, 0, err
	}
	return uint64(projectCount), stories.StoryCount, stories.WordCount, rankings.RatingCount, uint64(followerCount), rankings.AverageRating, nil
}

// AuthorFollowerCount 只查作者收藏數這一個數字，不像 PublicAuthorSummary 還要一併算
// 作品數／字數／評分等統計——故事閱讀頁只需要這一個數字，不用為此多跑一次昂貴的組合查詢。
func (r *Repository) AuthorFollowerCount(userID uint64) (uint64, error) {
	var followerCount int64
	if err := r.db.
		Table("storyteller_author_favorites").
		Where("author_user_id = ? AND deleted_at IS NULL", userID).
		Count(&followerCount).Error; err != nil {
		return 0, err
	}
	return uint64(followerCount), nil
}

func (r *Repository) ProjectFavoriteCounts(projectIDs []uint64) (map[uint64]uint64, error) {
	counts := make(map[uint64]uint64, len(projectIDs))
	if len(projectIDs) == 0 {
		return counts, nil
	}
	type result struct {
		ProjectID uint64
		Count     uint64
	}
	rows := make([]result, 0)
	if err := r.db.
		Table("storyteller_project_rankings").
		Select("project_id, COUNT(*) AS count").
		Where("project_id IN ? AND is_favorite = 1 AND deleted_at IS NULL", projectIDs).
		Group("project_id").
		Scan(&rows).Error; err != nil {
		return nil, err
	}
	for _, row := range rows {
		counts[row.ProjectID] = row.Count
	}
	return counts, nil
}

func (r *Repository) PublicFavoriteProjects(authorUserID uint64, includeHidden bool) ([]storytellerModel.Project, error) {
	rows := make([]storytellerModel.Project, 0)
	query := r.db.
		Table("storyteller_projects").
		Select("storyteller_projects.*").
		Joins("INNER JOIN storyteller_project_rankings ON storyteller_project_rankings.project_id = storyteller_projects.id").
		Where("storyteller_project_rankings.user_id = ? AND storyteller_project_rankings.deleted_at IS NULL", authorUserID).
		Where("storyteller_project_rankings.is_favorite = 1")
	if !includeHidden {
		query = query.Where("storyteller_project_rankings.favorite_hidden = 0")
	}
	err := query.
		Where("storyteller_projects.visibility = ? AND storyteller_projects.deleted_at IS NULL", storytellerModel.ProjectVisibilityPublic).
		Order("storyteller_project_rankings.updated_at DESC, storyteller_project_rankings.id DESC").
		Find(&rows).Error
	return rows, err
}

func (r *Repository) FavoriteProjectHiddenFlags(userID uint64, projectIDs []uint64) (map[uint64]bool, error) {
	flags := make(map[uint64]bool, len(projectIDs))
	if len(projectIDs) == 0 {
		return flags, nil
	}
	type result struct {
		ProjectID      uint64
		FavoriteHidden bool
	}
	rows := make([]result, 0)
	if err := r.db.
		Table("storyteller_project_rankings").
		Select("project_id, favorite_hidden").
		Where("user_id = ? AND project_id IN ? AND deleted_at IS NULL", userID, projectIDs).
		Scan(&rows).Error; err != nil {
		return nil, err
	}
	for _, row := range rows {
		flags[row.ProjectID] = row.FavoriteHidden
	}
	return flags, nil
}

func (r *Repository) PublicFavoriteAuthors(authorUserID uint64, includeHidden bool) ([]storytellerModel.AuthorFavorite, error) {
	rows := make([]storytellerModel.AuthorFavorite, 0)
	query := r.db.Where("user_id = ? AND deleted_at IS NULL", authorUserID)
	if !includeHidden {
		query = query.Where("hidden = 0")
	}
	err := query.Order("updated_at DESC, id DESC").Find(&rows).Error
	return rows, err
}

func (r *Repository) SetFavoriteProjectHidden(userID, projectID uint64, hidden bool) error {
	return r.db.
		Table("storyteller_project_rankings").
		Where("user_id = ? AND project_id = ? AND deleted_at IS NULL", userID, projectID).
		Update("favorite_hidden", hidden).Error
}

func (r *Repository) SetFavoriteAuthorHidden(userID, authorUserID uint64, hidden bool) error {
	return r.db.
		Table("storyteller_author_favorites").
		Where("user_id = ? AND author_user_id = ? AND deleted_at IS NULL", userID, authorUserID).
		Update("hidden", hidden).Error
}

func (r *Repository) Ranking(userID, projectID uint64) (*storytellerModel.ProjectRanking, error) {
	var row storytellerModel.ProjectRanking
	err := r.db.Unscoped().
		Where("user_id = ? AND project_id = ?", userID, projectID).
		First(&row).Error
	return &row, err
}

func (r *Repository) CreateRanking(row *storytellerModel.ProjectRanking) error {
	return r.db.Create(row).Error
}

func (r *Repository) SaveRanking(row *storytellerModel.ProjectRanking) error {
	return r.db.Save(row).Error
}

func (r *Repository) RankingSummary(projectID uint64) (uint64, float64, error) {
	type result struct {
		Count   uint64
		Average float64
	}
	var row result
	err := r.db.
		Table("storyteller_project_rankings").
		Select("COUNT(*) AS count, COALESCE(AVG(ranking), 0) AS average").
		Where("project_id = ? AND ranking IS NOT NULL AND deleted_at IS NULL", projectID).
		Scan(&row).Error
	return row.Count, row.Average, err
}

func (r *Repository) PublicProjectsByUserID(userID uint64, offset, limit int) ([]storytellerModel.Project, int64, error) {
	rows := make([]storytellerModel.Project, 0)
	var total int64
	query := r.db.Model(&storytellerModel.Project{}).Where("user_id = ? AND visibility = ? AND deleted_at IS NULL", userID, storytellerModel.ProjectVisibilityPublic)
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := query.Order("updated_at DESC, id DESC").
		Offset(offset).Limit(limit).
		Find(&rows).Error
	return rows, total, err
}

func (r *Repository) UserProfile(userID uint64) (*storytellerModel.UserProfile, error) {
	var row storytellerModel.UserProfile
	err := r.db.Where("user_id = ? AND deleted_at IS NULL", userID).First(&row).Error
	return &row, err
}

func (r *Repository) UserProfileWithDeleted(userID uint64) (*storytellerModel.UserProfile, error) {
	var row storytellerModel.UserProfile
	err := r.db.Unscoped().Where("user_id = ?", userID).First(&row).Error
	return &row, err
}

func (r *Repository) UserProfileByPenName(penName string) (*storytellerModel.UserProfile, error) {
	var row storytellerModel.UserProfile
	err := r.db.Where("pen_name = ? AND deleted_at IS NULL", penName).First(&row).Error
	return &row, err
}

func (r *Repository) CreateUserProfile(row *storytellerModel.UserProfile) error {
	return r.db.Create(row).Error
}

func (r *Repository) SaveUserProfile(row *storytellerModel.UserProfile) error {
	return r.db.Save(row).Error
}

func (r *Repository) DeleteUserProfile(row *storytellerModel.UserProfile) error {
	now := time.Now()
	return r.db.Model(row).Updates(map[string]any{"deleted_at": &now}).Error
}
