package storyteller

import (
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

// SitemapItem 是 sitemap 的一筆內容；ItemPublicID 為空代表作品首頁本身
type SitemapItem struct {
	ProjectPublicID string    `gorm:"column:project_public_id"`
	ProjectSlug     string    `gorm:"column:project_slug"`
	ItemPublicID    string    `gorm:"column:item_public_id"`
	UpdatedAt       time.Time `gorm:"column:updated_at"`
}

// SitemapStories 公開專案裡讀者看得到的故事：條件跟 PublishedStories 一致（已發佈、不是冊、所屬冊也已發佈）
func (r *Repository) SitemapStories(limit int) ([]SitemapItem, error) {
	rows := make([]SitemapItem, 0)
	err := r.db.
		Table("storyteller_projects AS projects").
		Joins("INNER JOIN storyteller_stories AS stories ON stories.project_id = projects.id AND stories.is_volume = 0 AND stories.is_deleted = 0 AND stories.deleted_at IS NULL AND stories.status = ?", storytellerModel.StoryStatusCompleted).
		Joins("LEFT JOIN storyteller_stories AS parent ON parent.id = stories.parent_id").
		Where("projects.visibility = ? AND projects.deleted_at IS NULL", storytellerModel.ProjectVisibilityPublic).
		Where("stories.parent_id IS NULL OR parent.status = ?", storytellerModel.StoryStatusCompleted).
		Select("projects.public_id AS project_public_id, projects.slug AS project_slug, stories.public_id AS item_public_id, stories.updated_at").
		Order("stories.updated_at DESC").
		Limit(limit).
		Scan(&rows).Error
	return rows, err
}

// SitemapLores 公開專案裡已公開的設定；含劇透的不列，避免搜尋結果直接秀出劇透標題
func (r *Repository) SitemapLores(limit int) ([]SitemapItem, error) {
	rows := make([]SitemapItem, 0)
	err := r.db.
		Table("storyteller_lores AS lores").
		Joins("INNER JOIN storyteller_projects AS projects ON projects.id = lores.project_id").
		Where("projects.visibility = ? AND projects.deleted_at IS NULL", storytellerModel.ProjectVisibilityPublic).
		Where("lores.status = ? AND lores.is_spoiler = 0 AND lores.is_deleted = 0 AND lores.deleted_at IS NULL", storytellerModel.StoryStatusCompleted).
		Select("projects.public_id AS project_public_id, projects.slug AS project_slug, lores.public_id AS item_public_id, lores.updated_at").
		Order("lores.updated_at DESC").
		Limit(limit).
		Scan(&rows).Error
	return rows, err
}

// SitemapAuthorPenNames 有公開作品的筆名（本人身份＋額外筆名），署名規則同 identityVisibleStoriesJoin
func (r *Repository) SitemapAuthorPenNames(limit int) ([]string, error) {
	names := make([]string, 0)
	err := r.db.Raw(`
		SELECT pen_name FROM (
			SELECT DISTINCT users.pen_name
			FROM storyteller_projects AS projects
			INNER JOIN storyteller_stories AS stories ON stories.project_id = projects.id AND stories.is_volume = 0 AND stories.is_deleted = 0 AND stories.deleted_at IS NULL AND stories.status = ?
			INNER JOIN storyteller_users AS users ON users.id = projects.user_id AND users.deleted_at IS NULL
			WHERE projects.visibility = ? AND projects.deleted_at IS NULL AND users.pen_name <> ''
			  AND (EXISTS (SELECT 1 FROM storyteller_story_profiles sp WHERE sp.story_id = stories.id AND sp.profile_id = 0)
			       OR NOT EXISTS (SELECT 1 FROM storyteller_story_profiles sp WHERE sp.story_id = stories.id))
			UNION
			SELECT DISTINCT profiles.pen_name
			FROM storyteller_projects AS projects
			INNER JOIN storyteller_stories AS stories ON stories.project_id = projects.id AND stories.is_volume = 0 AND stories.is_deleted = 0 AND stories.deleted_at IS NULL AND stories.status = ?
			INNER JOIN storyteller_story_profiles AS sp ON sp.story_id = stories.id
			INNER JOIN storyteller_author_profiles AS profiles ON profiles.id = sp.profile_id AND profiles.deleted_at IS NULL
			WHERE projects.visibility = ? AND projects.deleted_at IS NULL
		) AS pen_names
		LIMIT ?`,
		storytellerModel.StoryStatusCompleted, storytellerModel.ProjectVisibilityPublic,
		storytellerModel.StoryStatusCompleted, storytellerModel.ProjectVisibilityPublic,
		limit,
	).Scan(&names).Error
	return names, err
}
