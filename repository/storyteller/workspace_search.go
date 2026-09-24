package storyteller

import (
	"strings"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

const workspaceSearchRelevanceSQL = `CASE
	WHEN %s = ? THEN 0
	WHEN %s LIKE ? ESCAPE '=' THEN 1
	WHEN %s LIKE ? ESCAPE '=' THEN 2
	ELSE 3
END AS relevance`

func workspaceSearchPatterns(keyword string) (exact, prefix, contains string) {
	exact = strings.TrimSpace(keyword)
	escaped := strings.NewReplacer("=", "==", "%", "=%", "_", "=_").Replace(exact)
	return exact, escaped + "%", "%" + escaped + "%"
}

func (r *Repository) WorkspaceSearchStories(projectID uint64, keyword string, limit int) ([]storytellerModel.WorkspaceSearchSource, error) {
	exact, prefix, contains := workspaceSearchPatterns(keyword)
	rows := make([]storytellerModel.WorkspaceSearchSource, 0)
	title := "stories.title"
	err := r.db.Table("storyteller_stories AS stories").
		Select(`'story' AS kind, stories.public_id, stories.content_type, stories.title,
			stories.summary, stories.latest_content AS content,
			COALESCE(volumes.public_id, '') AS collection_public_id,
			COALESCE(volumes.title, '') AS collection_name, stories.updated_at, `+
			fmtWorkspaceSearchRelevance(title), exact, prefix, contains).
		Joins("LEFT JOIN storyteller_stories AS volumes ON volumes.id = stories.parent_id AND volumes.is_volume = 1 AND volumes.is_deleted = 0 AND volumes.deleted_at IS NULL").
		Where("stories.project_id = ? AND stories.is_volume = 0 AND stories.is_deleted = 0 AND stories.deleted_at IS NULL", projectID).
		Where("(stories.title LIKE ? ESCAPE '=' OR stories.summary LIKE ? ESCAPE '=' OR stories.latest_content LIKE ? ESCAPE '=')", contains, contains, contains).
		Order("relevance ASC, stories.updated_at DESC, stories.id DESC").
		Limit(limit).
		Scan(&rows).Error
	return rows, err
}

func (r *Repository) WorkspaceSearchLores(projectID uint64, keyword string, limit int) ([]storytellerModel.WorkspaceSearchSource, error) {
	exact, prefix, contains := workspaceSearchPatterns(keyword)
	rows := make([]storytellerModel.WorkspaceSearchSource, 0)
	title := "lores.title"
	err := r.db.Table("storyteller_lores AS lores").
		Select(`'lore' AS kind, lores.public_id, '' AS content_type, lores.title,
			'' AS summary, lores.latest_content AS content, COALESCE(collections.public_id, '') AS collection_public_id,
			COALESCE(collections.name, '') AS collection_name, lores.updated_at, `+
			fmtWorkspaceSearchRelevance(title), exact, prefix, contains).
		Joins("LEFT JOIN storyteller_lore_collections AS collections ON collections.id = lores.collection_id AND collections.is_deleted = 0 AND collections.deleted_at IS NULL").
		Where("lores.project_id = ? AND lores.is_deleted = 0 AND lores.deleted_at IS NULL", projectID).
		Where("(lores.title LIKE ? ESCAPE '=' OR lores.latest_content LIKE ? ESCAPE '=')", contains, contains).
		Order("relevance ASC, lores.updated_at DESC, lores.id DESC").
		Limit(limit).
		Scan(&rows).Error
	return rows, err
}

func (r *Repository) WorkspaceSearchAssets(projectID uint64, keyword string, limit int) ([]storytellerModel.WorkspaceSearchSource, error) {
	exact, prefix, contains := workspaceSearchPatterns(keyword)
	rows := make([]storytellerModel.WorkspaceSearchSource, 0)
	title := "COALESCE(NULLIF(assets.title, ''), assets.original_filename)"
	err := r.db.Table("storyteller_assets AS assets").
		Select(`'asset' AS kind, assets.public_id, '' AS content_type,
			COALESCE(NULLIF(assets.title, ''), assets.original_filename) AS title,
			'' AS summary, CONCAT_WS('\n', NULLIF(assets.original_filename, ''), NULLIF(assets.alt_text, ''), NULLIF(assets.description, '')) AS content,
			COALESCE(collections.public_id, '') AS collection_public_id,
			COALESCE(collections.name, '') AS collection_name, assets.updated_at, `+
			fmtWorkspaceSearchRelevance(title), exact, prefix, contains).
		Joins("LEFT JOIN storyteller_asset_collections AS collections ON collections.id = assets.collection_id AND collections.is_deleted = 0 AND collections.deleted_at IS NULL").
		Where("assets.project_id = ? AND assets.is_deleted = 0 AND assets.deleted_at IS NULL", projectID).
		Where("(assets.title LIKE ? ESCAPE '=' OR assets.original_filename LIKE ? ESCAPE '=' OR assets.alt_text LIKE ? ESCAPE '=' OR assets.description LIKE ? ESCAPE '=')", contains, contains, contains, contains).
		Order("relevance ASC, assets.updated_at DESC, assets.id DESC").
		Limit(limit).
		Scan(&rows).Error
	return rows, err
}

func fmtWorkspaceSearchRelevance(title string) string {
	return strings.NewReplacer("%s", title).Replace(workspaceSearchRelevanceSQL)
}
