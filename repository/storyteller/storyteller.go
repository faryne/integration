package storyteller

import (
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/model/enum"
	"faryne.dev/service/client"
	"gorm.io/gorm"
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

func (r *Repository) CreateAgent(row *storytellerModel.Agent) error {
	return r.db.Create(row).Error
}

func (r *Repository) UpdateAgent(row *storytellerModel.Agent) error {
	return r.db.Save(row).Error
}

func (r *Repository) DeleteAgent(row *storytellerModel.Agent) error {
	now := time.Now()
	return r.db.Model(row).Updates(map[string]any{"is_deleted": true, "deleted_at": &now}).Error
}

func (r *Repository) Stories(projectID uint64) ([]storytellerModel.Story, error) {
	rows := make([]storytellerModel.Story, 0)
	err := r.db.Where("project_id = ? AND deleted_at IS NULL", projectID).
		Order("sort ASC, id ASC").
		Find(&rows).Error
	return rows, err
}

func (r *Repository) Story(projectID uint64, publicID string) (*storytellerModel.Story, error) {
	var row storytellerModel.Story
	err := r.db.Where("project_id = ? AND public_id = ? AND deleted_at IS NULL", projectID, publicID).
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
	return r.db.Model(row).Updates(map[string]any{"deleted_at": &now}).Error
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
