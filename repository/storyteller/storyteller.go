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

func (r *Repository) Stories(projectID uint64) ([]storytellerModel.Story, error) {
	rows := make([]storytellerModel.Story, 0)
	err := r.db.Where("project_id = ? AND is_deleted = 0 AND deleted_at IS NULL", projectID).
		Order("sort ASC, id ASC").
		Find(&rows).Error
	return rows, err
}

func (r *Repository) PublishedStories(projectID uint64) ([]storytellerModel.Story, error) {
	rows := make([]storytellerModel.Story, 0)
	err := r.db.Where("project_id = ? AND status = ? AND is_deleted = 0 AND deleted_at IS NULL", projectID, storytellerModel.StoryStatusCompleted).
		Order("sort ASC, id ASC").
		Find(&rows).Error
	return rows, err
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

func (r *Repository) Lores(projectID uint64) ([]storytellerModel.Lore, error) {
	rows := make([]storytellerModel.Lore, 0)
	err := r.db.Where("project_id = ? AND is_deleted = 0 AND deleted_at IS NULL", projectID).
		Order("updated_at DESC, id DESC").
		Find(&rows).Error
	return rows, err
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

func (r *Repository) CreateStoryChatWithMessages(chat *storytellerModel.StoryChat, messages []storytellerModel.StoryChatMessage) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(chat).Error; err != nil {
			return err
		}
		for i := range messages {
			messages[i].ChatID = chat.ID
		}
		return tx.Create(&messages).Error
	})
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

func (r *Repository) CreateStoryWithVersion(story *storytellerModel.Story, version *storytellerModel.StoryVersion) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(story).Error; err != nil {
			return err
		}
		version.StoryID = story.ID
		return tx.Create(version).Error
	})
}

func (r *Repository) UpdateStoryWithVersion(story *storytellerModel.Story, version *storytellerModel.StoryVersion) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(story).Error; err != nil {
			return err
		}
		version.StoryID = story.ID
		return tx.Create(version).Error
	})
}

func (r *Repository) DeleteStory(row *storytellerModel.Story) error {
	now := time.Now()
	return r.db.Model(row).Updates(map[string]any{"is_deleted": true, "deleted_at": &now}).Error
}

func (r *Repository) CreateLoreWithVersion(lore *storytellerModel.Lore, version *storytellerModel.LoreVersion) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(lore).Error; err != nil {
			return err
		}
		version.LoreID = lore.ID
		return tx.Create(version).Error
	})
}

func (r *Repository) UpdateLoreWithVersion(lore *storytellerModel.Lore, version *storytellerModel.LoreVersion) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Save(lore).Error; err != nil {
			return err
		}
		version.LoreID = lore.ID
		return tx.Create(version).Error
	})
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
