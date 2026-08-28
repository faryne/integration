package storyteller

import (
	"encoding/json"
	"errors"
	"strconv"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/model/enum"
	"faryne.dev/service/client"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type Repository struct{ db *gorm.DB }

// ErrStoryChatNotCompletable 代表這筆 chat 已經完成、還沒被 claim 成 in_progress，
// 或底下已經有 assistant 訊息。呼叫端不能再補寫第二份 AI 回覆。
var ErrStoryChatNotCompletable = errors.New("story chat is not completable")

const agenticChatStaleInProgressMinutes = "8"
const agenticChatOutputStatusSQL = `CASE
				WHEN chats.status = 'in_progress' AND chats.updated_at < DATE_SUB(NOW(), INTERVAL ` + agenticChatStaleInProgressMinutes + ` MINUTE) THEN 'pending'
				ELSE chats.status
			END AS chat_status`
const agenticChatStaleInProgressClaimSQL = `(status = ? OR (status = ? AND updated_at < DATE_SUB(NOW(), INTERVAL ` + agenticChatStaleInProgressMinutes + ` MINUTE)))`

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

// ProjectByPublicIDForPublicReader 給主要內容閱讀頁（PublicProject／版本查詢）用：只放行
// 真正公開的專案，或是專案本人（userID 對上 user_id）——刻意不像 ProjectByPublicIDForReader
// 那樣連 unlisted 都放行，因為 unlisted 的訪問邊界是「知道分享連結」，不該用猜 public_id
// 就能直接看到內容；本人預覽自己私人／不公開連結的草稿則不受此限制。userID 為 0
// （未登入或匿名訪客）時第二個條件恆假，行為等同 ProjectByPublicID。
func (r *Repository) ProjectByPublicIDForPublicReader(userID uint64, publicID string) (*storytellerModel.Project, error) {
	var row storytellerModel.Project
	err := r.db.Where(
		"public_id = ? AND deleted_at IS NULL AND (visibility = ? OR user_id = ?)",
		publicID, storytellerModel.ProjectVisibilityPublic, userID,
	).First(&row).Error
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

// ProjectByPublicIDForReader 給「讀者視角」的功能用（書籤、版本查詢）：公開／不公開連結
// 的專案本來就對任何人開放；私人專案則只有本人（userID 對上 user_id）能通過——讓作者
// 自己在 Reader 頁預覽/操作自己的私人草稿時，書籤等功能不會被 visibility 擋掉。
// userID 為 0（未登入）時第二個條件恆假，行為等同 ProjectByPublicIDForFavorite。
func (r *Repository) ProjectByPublicIDForReader(userID uint64, publicID string) (*storytellerModel.Project, error) {
	var row storytellerModel.Project
	err := r.db.Where(
		"public_id = ? AND deleted_at IS NULL AND (visibility IN ? OR user_id = ?)",
		publicID,
		[]storytellerModel.ProjectVisibility{
			storytellerModel.ProjectVisibilityPublic,
			storytellerModel.ProjectVisibilityUnlisted,
		},
		userID,
	).First(&row).Error
	return &row, err
}

func (r *Repository) ProjectByPublicIDForUser(userID uint64, publicID string) (*storytellerModel.Project, error) {
	var row storytellerModel.Project
	err := r.db.Where("user_id = ? AND public_id = ? AND deleted_at IS NULL", userID, publicID).
		First(&row).Error
	return &row, err
}

func (r *Repository) ProjectByID(id uint64) (*storytellerModel.Project, error) {
	var row storytellerModel.Project
	err := r.db.Where("id = ? AND deleted_at IS NULL", id).First(&row).Error
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

// AgentModelPrice 查某個固定模型清單供應商（allow_custom_model=0）底下指定
// model 目前的單價快照（每 token 美金，JSON 字串）。查不到（self_hosted／
// openrouter 自訂名稱、model 已下架、或該 model 從來沒有價格資料）回傳
// (nil, nil)，呼叫端拿這個值當 usage log 寫入當下的快照用，找不到不算錯誤。
func (r *Repository) AgentModelPrice(provider storytellerModel.AgentProvider, modelName string) (*string, error) {
	var row struct {
		Price *string `gorm:"column:price"`
	}
	err := r.db.Table("storyteller_agent_models AS models").
		Select("models.price AS price").
		Joins(`JOIN storyteller_agent_providers AS providers
			ON providers.id = models.provider_id AND providers.allow_custom_model = 0`).
		Where("providers.provider = ? AND models.name = ?", provider, modelName).
		Take(&row).Error
	if err != nil {
		if errors.Is(err, gorm.ErrRecordNotFound) {
			return nil, nil
		}
		return nil, err
	}
	return row.Price, nil
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

func (r *Repository) ImageStoriesForAssetBackfill() ([]storytellerModel.Story, error) {
	rows := make([]storytellerModel.Story, 0)
	err := r.db.Where("content_type = ? AND is_volume = 0 AND is_deleted = 0 AND deleted_at IS NULL", storytellerModel.ProjectContentTypeImage).
		Order("project_id ASC, id ASC").
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

// PublishedStories 只回傳「自己是 completed，而且沒有掛在一個 draft 冊底下」的故事：
// 冊關閉（draft）時，底下所有故事一律不對外顯示，不管故事自己的 status 是什麼，
// 靠 LEFT JOIN 回自己的 parent 冊，比對 parent 的 status 做到這個級聯關閉的效果。
func (r *Repository) PublishedStories(projectID uint64) ([]storytellerModel.Story, error) {
	rows := make([]storytellerModel.Story, 0)
	err := r.db.
		Table("storyteller_stories AS stories").
		Joins("LEFT JOIN storyteller_stories AS parent ON parent.id = stories.parent_id").
		Where("stories.project_id = ? AND stories.status = ? AND stories.is_volume = 0 AND stories.is_deleted = 0 AND stories.deleted_at IS NULL", projectID, storytellerModel.StoryStatusCompleted).
		Where("stories.parent_id IS NULL OR parent.status = ?", storytellerModel.StoryStatusCompleted).
		Order("stories.sort ASC, stories.id ASC").
		Select("stories.*").
		Find(&rows).Error
	return rows, err
}

// Volumes 回傳一個專案底下的冊列表（is_volume = 1），跟 Stories 分開拿。給登入的作者
// 自己管理用，不篩選 status——公開頁要用 PublishedVolumes。
func (r *Repository) Volumes(projectID uint64) ([]storytellerModel.Story, error) {
	rows := make([]storytellerModel.Story, 0)
	err := r.db.Where("project_id = ? AND is_volume = 1 AND is_deleted = 0 AND deleted_at IS NULL", projectID).
		Order("sort ASC, id ASC").
		Find(&rows).Error
	return rows, err
}

// PublishedVolumes 是 Volumes 的公開版本，只回傳 status=completed 的冊，給不含草稿的
// 專案輸出（公開閱讀頁／分享頁）用。
func (r *Repository) PublishedVolumes(projectID uint64) ([]storytellerModel.Story, error) {
	rows := make([]storytellerModel.Story, 0)
	err := r.db.Where("project_id = ? AND is_volume = 1 AND status = ? AND is_deleted = 0 AND deleted_at IS NULL", projectID, storytellerModel.StoryStatusCompleted).
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

// StoryByID 用內部 ID 查故事，給只有 parent_id（沒有 public_id）的場合用，例如搜尋索引
// 同步時要判斷一篇故事掛的冊目前是不是 completed。
func (r *Repository) StoryByID(id uint64) (*storytellerModel.Story, error) {
	var row storytellerModel.Story
	err := r.db.Where("id = ? AND is_deleted = 0 AND deleted_at IS NULL", id).First(&row).Error
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
		Order("story_version_id DESC, line_id ASC").
		Find(&rows).Error
	return rows, err
}

// ProjectStoryBookmarks 只查書籤本身＋所屬故事的基本資訊；圖片書籤的 PageSort／
// ThumbnailURL、文字書籤的 LinePreview 都需要解析內容（圖片是 LatestContent 的 JSON，
// 文字是把 line_id 對應的段落分組解析出來），SQL 做不到，交給 service 層依 content_type
// 分開組好再填入——文字書籤的分組邏輯必須跟前端 groupParagraphsByBlockKind 完全一致
// （見 groupStoryLinesByBlockKind 的說明），不能再像以前那樣用 SQL 字串位置硬切一行，
// 那招只適用「行＝定位單位」，換成「組＝定位單位」後沒辦法在 SQL 裡表達分組規則。
func (r *Repository) ProjectStoryBookmarks(userID, projectID uint64) ([]storytellerModel.StoryBookmarkOutput, error) {
	rows := make([]storytellerModel.StoryBookmarkOutput, 0)
	err := r.db.
		Table("storyteller_story_bookmarks AS bookmarks").
		Joins("INNER JOIN storyteller_stories AS stories ON stories.id = bookmarks.story_id").
		Where("bookmarks.user_id = ? AND stories.project_id = ? AND stories.is_deleted = 0 AND stories.deleted_at IS NULL", userID, projectID).
		Select(`bookmarks.id,
			bookmarks.story_id,
			stories.public_id AS story_public_id,
			stories.title AS story_title,
			stories.content_type AS content_type,
			bookmarks.story_version_id,
			bookmarks.line_id,
			bookmarks.created_at,
			CASE WHEN bookmarks.story_version_id IS NOT NULL THEN
				(SELECT v.id FROM storyteller_story_versions AS v
					WHERE v.story_id = bookmarks.story_id AND v.deleted_at IS NULL
					ORDER BY v.created_at DESC, v.id DESC LIMIT 1)
				ELSE NULL END AS latest_story_version_id`).
		Order("bookmarks.created_at DESC, bookmarks.id DESC").
		Find(&rows).Error
	return rows, err
}

// StoryBookmark 查單一書籤是否存在：versionID 為 nil 代表圖片書籤（line_id 是頁面 id，
// 不綁版本），這時只用 user_id + story_id + line_id 比對；文字書籤則額外比對
// story_version_id，同一行在不同版本算不同書籤。
func (r *Repository) StoryBookmark(userID, storyID uint64, versionID *uint64, lineID string) (*storytellerModel.StoryBookmark, error) {
	var row storytellerModel.StoryBookmark
	query := r.db.Where("user_id = ? AND story_id = ? AND line_id = ?", userID, storyID, lineID)
	if versionID != nil {
		query = query.Where("story_version_id = ?", *versionID)
	} else {
		query = query.Where("story_version_id IS NULL")
	}
	err := query.First(&row).Error
	return &row, err
}

func (r *Repository) CreateStoryBookmark(row *storytellerModel.StoryBookmark) error {
	return r.db.Create(row).Error
}

func (r *Repository) DeleteStoryBookmark(userID, storyID uint64, versionID *uint64, lineID string) error {
	query := r.db.Where("user_id = ? AND story_id = ? AND line_id = ?", userID, storyID, lineID)
	if versionID != nil {
		query = query.Where("story_version_id = ?", *versionID)
	} else {
		query = query.Where("story_version_id IS NULL")
	}
	return query.Delete(&storytellerModel.StoryBookmark{}).Error
}

func (r *Repository) Lores(projectID uint64) ([]storytellerModel.Lore, error) {
	rows := make([]storytellerModel.Lore, 0)
	err := r.db.Where("project_id = ? AND is_deleted = 0 AND deleted_at IS NULL", projectID).
		Order("updated_at DESC, id DESC").
		Find(&rows).Error
	return rows, err
}

// LoresPage 是 Lores 的分頁版本，語意跟 StoriesPage 一樣。
func (r *Repository) LoresPage(projectID uint64, collectionID *uint64, uncategorizedOnly bool, offset, limit int) ([]storytellerModel.Lore, int64, error) {
	query := r.db.Model(&storytellerModel.Lore{}).
		Where("project_id = ? AND is_deleted = 0 AND deleted_at IS NULL", projectID)
	if uncategorizedOnly {
		query = query.Where("collection_id IS NULL")
	} else if collectionID != nil {
		query = query.Where("collection_id = ?", *collectionID)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	rows := make([]storytellerModel.Lore, 0)
	err := query.
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

func (r *Repository) MoveLore(row *storytellerModel.Lore) error {
	return r.db.Model(row).Update("collection_id", row.CollectionID).Error
}

func (r *Repository) LoreCollections(projectID uint64) ([]storytellerModel.LoreCollection, error) {
	rows := make([]storytellerModel.LoreCollection, 0)
	err := r.db.Where("project_id = ? AND is_deleted = 0 AND deleted_at IS NULL", projectID).
		Order("sort ASC, id ASC").
		Find(&rows).Error
	return rows, err
}

func (r *Repository) LoreCollection(projectID uint64, publicID string) (*storytellerModel.LoreCollection, error) {
	var row storytellerModel.LoreCollection
	err := r.db.Where("project_id = ? AND public_id = ? AND is_deleted = 0 AND deleted_at IS NULL", projectID, publicID).
		First(&row).Error
	return &row, err
}

func (r *Repository) CreateLoreCollection(row *storytellerModel.LoreCollection) error {
	return r.db.Create(row).Error
}

func (r *Repository) UpdateLoreCollection(row *storytellerModel.LoreCollection) error {
	return r.db.Model(row).Updates(map[string]any{"name": row.Name, "description": row.Description, "sort": row.Sort}).Error
}

func (r *Repository) DeleteLoreCollection(row *storytellerModel.LoreCollection) error {
	now := time.Now()
	return r.db.Model(row).Updates(map[string]any{"is_deleted": true, "deleted_at": &now}).Error
}

func (r *Repository) LoreCollectionLoreCount(collectionID uint64) (int64, error) {
	var count int64
	err := r.db.Model(&storytellerModel.Lore{}).
		Where("collection_id = ? AND is_deleted = 0 AND deleted_at IS NULL", collectionID).
		Count(&count).Error
	return count, err
}

func (r *Repository) LoreCollectionLoreCounts(collectionIDs []uint64) (map[uint64]int64, error) {
	counts := make(map[uint64]int64)
	if len(collectionIDs) == 0 {
		return counts, nil
	}
	var rows []struct {
		CollectionID uint64
		Count        int64
	}
	if err := r.db.Model(&storytellerModel.Lore{}).
		Select("collection_id, COUNT(*) AS count").
		Where("collection_id IN ? AND is_deleted = 0 AND deleted_at IS NULL", collectionIDs).
		Group("collection_id").
		Scan(&rows).Error; err != nil {
		return nil, err
	}
	for _, row := range rows {
		counts[row.CollectionID] = row.Count
	}
	return counts, nil
}

// LoreProjectCounts 給工作台側邊欄「全部設定」「未分類」用——這兩個是虛擬節點，
// 不對應任何一筆 LoreCollection 資料列，所以不能沿用 LoreCollectionLoreCounts
// 那種依 collection_id 分組的做法，得直接對整個專案的 lore 表算。
func (r *Repository) LoreProjectCounts(projectID uint64) (total int64, uncategorized int64, err error) {
	var row struct {
		Total         int64
		Uncategorized int64
	}
	err = r.db.Model(&storytellerModel.Lore{}).
		Select("COUNT(*) AS total, SUM(CASE WHEN collection_id IS NULL THEN 1 ELSE 0 END) AS uncategorized").
		Where("project_id = ? AND is_deleted = 0 AND deleted_at IS NULL", projectID).
		Scan(&row).Error
	return row.Total, row.Uncategorized, err
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

func (r *Repository) CreateStoryChatWithMessages(chat *storytellerModel.StoryChat, messages []storytellerModel.StoryChatMessage, proposals []storytellerModel.AgentProposal, usage *storytellerModel.AgentUsageLog) error {
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
		if len(proposals) > 0 {
			for i := range proposals {
				proposals[i].ChatID = chat.ID
			}
			if err := tx.Create(&proposals).Error; err != nil {
				return err
			}
		}
		if usage == nil {
			return nil
		}
		usage.ChatID = chat.ID
		return tx.Create(usage).Error
	})
}

// CreateInProgressChatWithUserMessage 先落地使用者這則問題，chat 直接進
// in_progress——代表原始 submit request 正在跑 provider。只有 provider 第一輪就
// 失敗、process 中斷後被掃描判定 stale，或其他明確失敗情境，才會退回 pending 讓
// 使用者重送；pending 不能同時代表「正在跑」跟「可重送」，否則前端會在正常等待時
// 就顯示誤導性的重送按鈕。
func (r *Repository) CreateInProgressChatWithUserMessage(chat *storytellerModel.StoryChat, userMessage *storytellerModel.StoryChatMessage) error {
	chat.Status = storytellerModel.StoryChatStatusInProgress
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Create(chat).Error; err != nil {
			return err
		}
		userMessage.ChatID = chat.ID
		return tx.Create(userMessage).Error
	})
}

// CompleteChatMessage 把 AI 的回覆補進一筆 in_progress chat。這裡也要做狀態與
// assistant 唯一性防護：初次 submit 和 resend 理論上不會同時跑，但 UI／網路重試／
// 惡意呼叫都有可能打出競態，不能只靠 Claim*ForResend 擋同類 resend。已 completed
// 或已有 assistant 的 chat 直接回 ErrStoryChatNotCompletable，不再插入第二份答案。
func (r *Repository) CompleteChatMessage(chatID uint64, assistantMessage *storytellerModel.StoryChatMessage, proposals []storytellerModel.AgentProposal, usage *storytellerModel.AgentUsageLog) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		var chat storytellerModel.StoryChat
		if err := tx.Clauses(clause.Locking{Strength: "UPDATE"}).
			Where("id = ?", chatID).
			First(&chat).Error; err != nil {
			return err
		}
		if chat.Status != storytellerModel.StoryChatStatusInProgress {
			return ErrStoryChatNotCompletable
		}
		var assistantCount int64
		if err := tx.Model(&storytellerModel.StoryChatMessage{}).
			Where("chat_id = ? AND role = ? AND deleted_at IS NULL", chatID, storytellerModel.ChatMessageRoleAssistant).
			Count(&assistantCount).Error; err != nil {
			return err
		}
		if assistantCount > 0 {
			return ErrStoryChatNotCompletable
		}
		if err := tx.Model(&storytellerModel.StoryChat{}).
			Where("id = ? AND status = ?", chatID, storytellerModel.StoryChatStatusInProgress).
			Update("status", storytellerModel.StoryChatStatusCompleted).Error; err != nil {
			return err
		}
		assistantMessage.ChatID = chatID
		if err := tx.Create(assistantMessage).Error; err != nil {
			return err
		}
		if len(proposals) > 0 {
			for i := range proposals {
				proposals[i].ChatID = chatID
			}
			if err := tx.Create(&proposals).Error; err != nil {
				return err
			}
		}
		if usage == nil {
			return nil
		}
		usage.ChatID = chatID
		return tx.Create(usage).Error
	})
}

// ClaimStoryChatForResend 把 pending 或超時卡住的 in_progress chat 標成
// in_progress，搶下「這輪由我重送」的資格。WHERE 子句同時鎖定 user_id／
// story_id，防止猜測 chat_id 去重送別人的或別篇故事的對話；RowsAffected 為 0
// 代表這筆不存在、不屬於這個使用者/故事、仍在正常處理中、已完成，或已被另一個
// 重送請求搶先。
func (r *Repository) ClaimStoryChatForResend(userID, storyID, chatID uint64) (int64, error) {
	result := r.db.Model(&storytellerModel.StoryChat{}).
		Where("id = ? AND user_id = ? AND story_id = ?", chatID, userID, storyID).
		Where(agenticChatStaleInProgressClaimSQL,
			storytellerModel.StoryChatStatusPending,
			storytellerModel.StoryChatStatusInProgress,
		).
		Update("status", storytellerModel.StoryChatStatusInProgress)
	return result.RowsAffected, result.Error
}

// ClaimLoreChatForResend 是 ClaimStoryChatForResend 的設定集版本。
func (r *Repository) ClaimLoreChatForResend(userID, loreID, chatID uint64) (int64, error) {
	result := r.db.Model(&storytellerModel.StoryChat{}).
		Where("id = ? AND user_id = ? AND lore_id = ?", chatID, userID, loreID).
		Where(agenticChatStaleInProgressClaimSQL,
			storytellerModel.StoryChatStatusPending,
			storytellerModel.StoryChatStatusInProgress,
		).
		Update("status", storytellerModel.StoryChatStatusInProgress)
	return result.RowsAffected, result.Error
}

// ReleaseChatToPending 重送呼叫 provider 失敗時，把狀態從 in_progress 退回
// pending，讓這則問題之後還能再重送一次，不會因為這次重送剛好也失敗就永遠卡死。
func (r *Repository) ReleaseChatToPending(chatID uint64) error {
	return r.db.Model(&storytellerModel.StoryChat{}).
		Where("id = ? AND status = ?", chatID, storytellerModel.StoryChatStatusInProgress).
		Update("status", storytellerModel.StoryChatStatusPending).Error
}

// ChatUserMessage 撈出一個 chat 底下那則使用者訊息——重送要用它當年存的內容當
// prompt，不相信前端這次重送傳來的文字，避免跟原始問題兜不起來或被竄改。
func (r *Repository) ChatUserMessage(chatID uint64) (*storytellerModel.StoryChatMessage, error) {
	var message storytellerModel.StoryChatMessage
	err := r.db.
		Where("chat_id = ? AND role = ?", chatID, storytellerModel.ChatMessageRoleUser).
		Order("id ASC").
		First(&message).Error
	if err != nil {
		return nil, err
	}
	return &message, nil
}

// AgentProposalsByChatIDs 一次撈出多個 chat 底下的所有提案，給 StoryChatMessages／
// LoreChatMessages 組 message 列表時依 chat_id 分組貼回對應的 assistant 訊息（見
// AgentProposal 的說明：一個 chat 剛好對應一則 assistant 訊息）。
func (r *Repository) AgentProposalsByChatIDs(chatIDs []uint64) ([]storytellerModel.AgentProposal, error) {
	rows := make([]storytellerModel.AgentProposal, 0)
	if len(chatIDs) == 0 {
		return rows, nil
	}
	err := r.db.Where("chat_id IN ?", chatIDs).Order("id ASC").Find(&rows).Error
	return rows, err
}

// AgentProposalByPublicIDForUser 找出指定的提案，同時透過 chat.user_id 確認這筆
// 提案真的屬於這個使用者——ApplyAgentProposal／RejectAgentProposal 都要先過這關，
// 不能只信任 URL 上的 project_public_id。
func (r *Repository) AgentProposalByPublicIDForUser(userID uint64, publicID string) (*storytellerModel.AgentProposal, error) {
	var row storytellerModel.AgentProposal
	err := r.db.
		Table("storyteller_agent_proposals AS proposals").
		Joins("INNER JOIN storyteller_story_chats AS chats ON chats.id = proposals.chat_id").
		Where("proposals.public_id = ? AND chats.user_id = ?", publicID, userID).
		Select("proposals.*").
		First(&row).Error
	return &row, err
}

// UpdateAgentProposalStatus 把提案標記成 applied／rejected，appliedAt 只有套用時
// 才帶值。用 Where 條件把 status='pending' 一併鎖進去，避免同一筆提案被重複套用
// 或套用/否決互相覆蓋（例如使用者連點兩次按鈕）——不是 pending 就代表已經有人
// 處理過，更新影響 0 筆，呼叫端要自己判斷 RowsAffected 是不是 0。
func (r *Repository) UpdateAgentProposalStatus(id uint64, status storytellerModel.AgentProposalStatus, appliedAt *time.Time) (int64, error) {
	result := r.db.Model(&storytellerModel.AgentProposal{}).
		Where("id = ? AND status = ?", id, storytellerModel.AgentProposalStatusPending).
		Updates(map[string]interface{}{"status": status, "applied_at": appliedAt})
	return result.RowsAffected, result.Error
}

// ResetAppliedAgentProposalToPending 把一筆已經 applied 的提案退回 pending、清掉
// applied_at——用在「回復到套用前版本」把內容退回去之後，這筆提案代表的決定
// 也要一併撤銷，讓使用者能重新選擇套用或否決，不能卡在只剩「查看變更」可以
// 按、卻永遠沒辦法重新套用的死路。Where 條件鎖 status='applied'，理由跟
// UpdateAgentProposalStatus 一樣：避免跟另一個並發請求（例如使用者連點兩次
// 「回復到套用前版本」）互相覆蓋。
func (r *Repository) ResetAppliedAgentProposalToPending(id uint64) (int64, error) {
	result := r.db.Model(&storytellerModel.AgentProposal{}).
		Where("id = ? AND status = ?", id, storytellerModel.AgentProposalStatusApplied).
		Updates(map[string]interface{}{
			"status":     storytellerModel.AgentProposalStatusPending,
			"applied_at": nil,
		})
	return result.RowsAffected, result.Error
}

func (r *Repository) AgentUsageSummary(userID uint64, from, to time.Time) ([]storytellerModel.AgentUsageSummaryRow, error) {
	rows := make([]storytellerModel.AgentUsageSummaryRow, 0)
	// project_id 沒有直接存在 usage log 上，透過 chat_id -> story_chats.story_id/
	// lore_id -> stories/lores.project_id 兩層 join 反查；story_id/lore_id
	// 互斥，COALESCE 兩邊的 project_id 剛好就是實際所屬專案。
	err := r.db.Table("storyteller_agent_usage_logs AS logs").
		Select(`logs.provider_apikey_id,
			logs.provider,
			apikeys.label AS provider_apikey_label,
			COALESCE(stories.project_id, lores.project_id) AS project_id,
			projects.public_id AS project_public_id,
			projects.name AS project_name,
			chats.story_id,
			stories.public_id AS story_public_id,
			stories.title AS story_title,
			chats.lore_id,
			lores.public_id AS lore_public_id,
			lores.title AS lore_title,
			SUM(logs.input_tokens) AS input_tokens,
			SUM(logs.output_tokens) AS output_tokens,
			SUM(logs.total_tokens) AS total_tokens,
			COUNT(*) AS run_count,
			SUM(
				logs.input_tokens * CAST(JSON_UNQUOTE(JSON_EXTRACT(logs.price, '$.prompt')) AS DECIMAL(20,12))
				+ logs.output_tokens * CAST(JSON_UNQUOTE(JSON_EXTRACT(logs.price, '$.completion')) AS DECIMAL(20,12))
			) AS estimated_cost_usd`).
		// "keys" 是 MySQL 保留字，當別名會造成語法錯誤，改用 apikeys
		Joins("LEFT JOIN storyteller_provider_apikeys AS apikeys ON apikeys.id = logs.provider_apikey_id").
		Joins("LEFT JOIN storyteller_story_chats AS chats ON chats.id = logs.chat_id").
		Joins("LEFT JOIN storyteller_stories AS stories ON stories.id = chats.story_id").
		Joins("LEFT JOIN storyteller_lores AS lores ON lores.id = chats.lore_id").
		Joins("LEFT JOIN storyteller_projects AS projects ON projects.id = COALESCE(stories.project_id, lores.project_id)").
		Where("logs.user_id = ? AND logs.created_at >= ? AND logs.created_at < ?", userID, from, to).
		Group(`logs.provider_apikey_id, logs.provider, apikeys.label,
			COALESCE(stories.project_id, lores.project_id), projects.public_id, projects.name,
			chats.story_id, stories.public_id, stories.title,
			chats.lore_id, lores.public_id, lores.title`).
		Order("logs.provider_apikey_id ASC, project_id ASC").
		Scan(&rows).Error
	return rows, err
}

// AgentUsageLogs 撈某把 key 底下、指定故事或設定集（storyID／loreID 互斥，
// 至少要帶一個，對應 AgentUsageSummary 分組出的某個 story/lore 節點）的單次
// 執行明細。
func (r *Repository) AgentUsageLogs(userID, providerAPIKeyID uint64, storyID, loreID *uint64, from, to time.Time, offset, limit int) ([]storytellerModel.AgentUsageLogRow, int64, error) {
	base := r.db.Table("storyteller_agent_usage_logs AS logs").
		Joins("LEFT JOIN storyteller_story_chats AS chats ON chats.id = logs.chat_id").
		Joins("LEFT JOIN storyteller_stories AS stories ON stories.id = chats.story_id").
		Joins("LEFT JOIN storyteller_lores AS lores ON lores.id = chats.lore_id").
		Where(
			"logs.user_id = ? AND logs.provider_apikey_id = ? AND logs.created_at >= ? AND logs.created_at < ?",
			userID, providerAPIKeyID, from, to,
		)
	if storyID != nil {
		base = base.Where("chats.story_id = ?", *storyID)
	}
	if loreID != nil {
		base = base.Where("chats.lore_id = ?", *loreID)
	}

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
			lores.title AS lore_title,
			logs.price AS model_price`).
		Order("logs.created_at DESC, logs.id DESC").
		Offset(offset).
		Limit(limit).
		Scan(&rows).Error
	if err != nil {
		return nil, 0, err
	}
	for i := range rows {
		rows[i].EstimatedCostUSD = estimateAgentUsageLogCostUSD(rows[i].ModelPrice, rows[i].InputTokens, rows[i].OutputTokens)
	}
	return rows, total, nil
}

// agentModelTokenPrice 對應 storyteller_agent_models.price 這個 JSON 欄位裡跟
// 費用估算相關的兩個欄位——格式沿用 OpenRouter 的 model catalog schema
// （prompt/completion，每 token 美金），這份欄位是跟供應商同步下來的，不是本專案
// 自訂格式，不能改名。
type agentModelTokenPrice struct {
	Prompt     string `json:"prompt"`
	Completion string `json:"completion"`
}

// estimateAgentUsageLogCostUSD 用 join 到的 model 單價快照估算這筆執行的花費；
// priceJSON 是 nil（join 不到，例如 self_hosted／openrouter 自訂 model 名稱）或
// 解析失敗都回傳 nil，不用預設值瞎猜成本。
func estimateAgentUsageLogCostUSD(priceJSON *string, inputTokens, outputTokens int) *float64 {
	if priceJSON == nil {
		return nil
	}
	var price agentModelTokenPrice
	if err := json.Unmarshal([]byte(*priceJSON), &price); err != nil {
		return nil
	}
	promptPrice, err := strconv.ParseFloat(price.Prompt, 64)
	if err != nil {
		return nil
	}
	completionPrice, err := strconv.ParseFloat(price.Completion, 64)
	if err != nil {
		return nil
	}
	cost := float64(inputTokens)*promptPrice + float64(outputTokens)*completionPrice
	return &cost
}

func (r *Repository) StoryChatMessages(storyID uint64, offset, limit int) ([]storytellerModel.StoryChatMessageOutput, int64, error) {
	rows := make([]storytellerModel.StoryChatMessageOutput, 0)
	query := r.db.
		Table("storyteller_story_chat_messages AS messages").
		Joins("INNER JOIN storyteller_story_chats AS chats ON chats.id = messages.chat_id").
		// LEFT JOIN（不是 INNER）＋直接吃 messages.agent_id（不 fallback 回
		// chats.agent_id）：agent_id 是 NULL 代表這則訊息當時沒有明確指定人設
		// （見 messageAgentID 的說明），這種訊息本來就該顯示成「沒有 Agent」，
		// 不能因為 INNER JOIN 找不到 agents.id=NULL 就把整列訊息從結果裡憑空
		// 濾掉。
		Joins("LEFT JOIN storyteller_agents AS agents ON agents.id = messages.agent_id").
		Where("chats.story_id = ? AND messages.deleted_at IS NULL", storyID)
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := query.
		Select(`messages.id,
			messages.chat_id,
			` + agenticChatOutputStatusSQL + `,
			messages.role,
			messages.content,
			messages.metadata,
			messages.created_at,
			messages.updated_at,
			COALESCE(messages.agent_id, 0) AS agent_id,
			COALESCE(agents.name, '') AS agent_name`).
		Order("messages.created_at DESC, messages.id DESC").
		Offset(offset).
		Limit(limit).
		Find(&rows).Error
	if err != nil {
		return rows, total, err
	}
	err = r.attachAgentProposals(rows)
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
		// 見 StoryChatMessages 的同一段說明：LEFT JOIN＋不 fallback 回
		// chats.agent_id，讓「沒有明確指定人設」的訊息正確顯示成沒有 Agent，
		// 而不是被 INNER JOIN 憑空濾掉或借用 chat 的 agent 掩蓋掉。
		Joins("LEFT JOIN storyteller_agents AS agents ON agents.id = messages.agent_id").
		Where("chats.lore_id = ? AND messages.deleted_at IS NULL", loreID)
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := query.
		Select(`messages.id,
			messages.chat_id,
			` + agenticChatOutputStatusSQL + `,
			messages.role,
			messages.content,
			messages.metadata,
			messages.created_at,
			messages.updated_at,
			COALESCE(messages.agent_id, 0) AS agent_id,
			COALESCE(agents.name, '') AS agent_name`).
		Order("messages.created_at DESC, messages.id DESC").
		Offset(offset).
		Limit(limit).
		Find(&rows).Error
	if err != nil {
		return rows, total, err
	}
	err = r.attachAgentProposals(rows)
	for i, j := 0, len(rows)-1; i < j; i, j = i+1, j-1 {
		rows[i], rows[j] = rows[j], rows[i]
	}
	return rows, total, err
}

// RecentStoryAgenticMessages 撈這個 story 底下最近幾則 agentic_query 模式的訊息
// （由舊到新排列，方便直接接在這輪呼叫的最前面當對話歷史）。只挑 agentic_query
// 模式，跳過 /rewrite 等 skill 模式的訊息——兩種語境的口吻差很多，混在一起容易讓
// 模型誤把 skill 那種單輪改寫指令當成正在對話。每輪 agentic 對話都是各自獨立的
// storyteller_story_chats 列（見 CreateStoryChatWithMessages），這裡直接跨 chat
// 撈同一個 story 底下所有訊息、依時間排序，讓「對話串」在模型端也連得起來。
func (r *Repository) RecentStoryAgenticMessages(storyID uint64, limit int) ([]storytellerModel.StoryChatMessage, error) {
	rows := make([]storytellerModel.StoryChatMessage, 0)
	chatLimit := agenticHistoryChatLimit(limit)
	err := r.db.
		Table("storyteller_story_chat_messages AS messages").
		Joins(`INNER JOIN (
			SELECT chats.id
			FROM storyteller_story_chats AS chats
			WHERE chats.story_id = ?
				AND chats.status = ?
				AND EXISTS (
					SELECT 1
					FROM storyteller_story_chat_messages AS pair_check
					WHERE pair_check.chat_id = chats.id
						AND pair_check.deleted_at IS NULL
					GROUP BY pair_check.chat_id
					HAVING COUNT(*) = 2
						AND SUM(CASE WHEN pair_check.role = ? THEN 1 ELSE 0 END) = 1
						AND SUM(CASE WHEN pair_check.role = ? AND JSON_UNQUOTE(JSON_EXTRACT(pair_check.metadata, '$.mode')) = ? THEN 1 ELSE 0 END) = 1
				)
			ORDER BY chats.created_at DESC, chats.id DESC
			LIMIT ?
		) AS recent_agentic_chats ON recent_agentic_chats.id = messages.chat_id`,
			storyID, storytellerModel.StoryChatStatusCompleted,
			storytellerModel.ChatMessageRoleUser,
			storytellerModel.ChatMessageRoleAssistant, "agentic_query",
			chatLimit).
		Where("messages.deleted_at IS NULL").
		// metadata 是 JSON column，MySQL 存回去會正規化格式（例如冒號後補一個空白），
		// 用字串 LIKE 比對格式很脆弱、容易對不上；改用 JSON_EXTRACT 直接取值比對，
		// 不受格式影響，也比 ->> 對 MySQL 5.7.x 更保守。舊版 user 訊息可能沒有
		// mode 標記，所以只要求 assistant 標成 agentic_query；chat 本身仍必須是
		// 完整的一問一答，避免孤兒訊息吃掉 history slot。
		Order("messages.created_at DESC, messages.id DESC").
		Find(&rows).Error
	if err != nil {
		return nil, err
	}
	for i, j := 0, len(rows)-1; i < j; i, j = i+1, j-1 {
		rows[i], rows[j] = rows[j], rows[i]
	}
	return rows, nil
}

// RecentLoreAgenticMessages 是 RecentStoryAgenticMessages 的設定集版本，見同一段說明。
func (r *Repository) RecentLoreAgenticMessages(loreID uint64, limit int) ([]storytellerModel.StoryChatMessage, error) {
	rows := make([]storytellerModel.StoryChatMessage, 0)
	chatLimit := agenticHistoryChatLimit(limit)
	err := r.db.
		Table("storyteller_story_chat_messages AS messages").
		Joins(`INNER JOIN (
			SELECT chats.id
			FROM storyteller_story_chats AS chats
			WHERE chats.lore_id = ?
				AND chats.status = ?
				AND EXISTS (
					SELECT 1
					FROM storyteller_story_chat_messages AS pair_check
					WHERE pair_check.chat_id = chats.id
						AND pair_check.deleted_at IS NULL
					GROUP BY pair_check.chat_id
					HAVING COUNT(*) = 2
						AND SUM(CASE WHEN pair_check.role = ? THEN 1 ELSE 0 END) = 1
						AND SUM(CASE WHEN pair_check.role = ? AND JSON_UNQUOTE(JSON_EXTRACT(pair_check.metadata, '$.mode')) = ? THEN 1 ELSE 0 END) = 1
				)
			ORDER BY chats.created_at DESC, chats.id DESC
			LIMIT ?
		) AS recent_agentic_chats ON recent_agentic_chats.id = messages.chat_id`,
			loreID, storytellerModel.StoryChatStatusCompleted,
			storytellerModel.ChatMessageRoleUser,
			storytellerModel.ChatMessageRoleAssistant, "agentic_query",
			chatLimit).
		Where("messages.deleted_at IS NULL").
		Order("messages.created_at DESC, messages.id DESC").
		Find(&rows).Error
	if err != nil {
		return nil, err
	}
	for i, j := 0, len(rows)-1; i < j; i, j = i+1, j-1 {
		rows[i], rows[j] = rows[j], rows[i]
	}
	return rows, nil
}

func agenticHistoryChatLimit(messageLimit int) int {
	if messageLimit < 2 {
		return 1
	}
	return (messageLimit + 1) / 2
}

// attachAgentProposals 把每個 chat 底下的提案貼回對應的 message 列（見
// AgentProposal 的說明：一個 chat 剛好對應一則 assistant 訊息，用 chat_id 對應
// 不會有歧義）；Arguments 存的是 JSON 字串，這裡順便解回 map 給前端用。
func (r *Repository) attachAgentProposals(rows []storytellerModel.StoryChatMessageOutput) error {
	chatIDs := make([]uint64, 0, len(rows))
	for _, row := range rows {
		chatIDs = append(chatIDs, row.ChatID)
	}
	proposals, err := r.AgentProposalsByChatIDs(chatIDs)
	if err != nil {
		return err
	}
	byChatID := make(map[uint64][]storytellerModel.AgenticProposalOutput, len(proposals))
	for _, p := range proposals {
		var arguments map[string]interface{}
		_ = json.Unmarshal([]byte(p.Arguments), &arguments)
		byChatID[p.ChatID] = append(byChatID[p.ChatID], storytellerModel.AgenticProposalOutput{
			PublicID:   p.PublicID,
			ToolCallID: p.ToolCallID,
			ToolName:   p.ToolName,
			Arguments:  arguments,
			Status:     p.Status,
		})
	}
	for i := range rows {
		// 一個 chat 底下有 user／assistant 兩則訊息，提案只跟著 assistant 那則走
		// （AI 提出的東西，不是使用者說的話）——user 訊息維持 nil，不然同一筆提案
		// 會在畫面上重複出現在兩則訊息底下。
		if rows[i].Role != storytellerModel.ChatMessageRoleAssistant {
			continue
		}
		rows[i].Proposals = byChatID[rows[i].ChatID]
	}
	return nil
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

// MoveStory 只更新 parent_id（冊隸屬），不建立新的 StoryVersion——跟 MoveLore 對稱，
// 純粹分類異動不算內容變更。volumeEvent 非 nil 時（parent_id 真的有變化）一併寫入
// 冊隸屬異動記錄，時間軸邏輯跟 UpdateStoryWithVersion 一致。
func (r *Repository) MoveStory(story *storytellerModel.Story, volumeEvent *storytellerModel.StoryVolumeEvent) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(story).Update("parent_id", story.ParentID).Error; err != nil {
			return err
		}
		if volumeEvent != nil {
			volumeEvent.StoryID = story.ID
			return tx.Create(volumeEvent).Error
		}
		return nil
	})
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

// PublicAuthorSummary 回傳作者頁統計：projectCount, storyCount（文字故事，不含話）,
// imageStoryCount（話）, ratingCount, followerCount, averageRating。故事數目跟話數目
// 分開算，跟專案卡片「N 篇故事／N 話」的語意一致；字數不在這裡統計——圖片描述算不算
// 字數很曖昧，乾脆不在作者頁呈現這個指標，只留故事/話的數目。
func (r *Repository) PublicAuthorSummary(userID uint64) (uint64, uint64, uint64, uint64, uint64, float64, error) {
	var projectCount int64
	if err := r.db.
		Table("storyteller_projects").
		Where("user_id = ? AND visibility = ? AND deleted_at IS NULL", userID, storytellerModel.ProjectVisibilityPublic).
		Count(&projectCount).Error; err != nil {
		return 0, 0, 0, 0, 0, 0, err
	}
	type storyResult struct {
		StoryCount      uint64
		ImageStoryCount uint64
	}
	var stories storyResult
	if err := r.db.
		Table("storyteller_projects AS projects").
		Select(
			"COUNT(CASE WHEN stories.content_type != ? THEN stories.id END) AS story_count, COUNT(CASE WHEN stories.content_type = ? THEN stories.id END) AS image_story_count",
			storytellerModel.ProjectContentTypeImage,
			storytellerModel.ProjectContentTypeImage,
		).
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
	return uint64(projectCount), stories.StoryCount, stories.ImageStoryCount, rankings.RatingCount, uint64(followerCount), rankings.AverageRating, nil
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
