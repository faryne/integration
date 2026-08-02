package storyteller

import (
	"strings"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"gorm.io/gorm"
)

func (r *Repository) Assets(projectID uint64, collectionID *uint64, uncategorizedOnly bool, assetType, keyword string, offset, limit int) ([]storytellerModel.Asset, int64, error) {
	rows := make([]storytellerModel.Asset, 0)
	query := r.db.Model(&storytellerModel.Asset{}).
		Where("project_id = ? AND is_deleted = 0 AND deleted_at IS NULL", projectID)
	if uncategorizedOnly {
		query = query.Where("collection_id IS NULL")
	} else if collectionID != nil {
		query = query.Where("collection_id = ?", *collectionID)
	}
	if strings.TrimSpace(assetType) != "" {
		query = query.Where("asset_type = ?", strings.TrimSpace(assetType))
	}
	if strings.TrimSpace(keyword) != "" {
		like := "%" + strings.TrimSpace(keyword) + "%"
		query = query.Where("title LIKE ? OR original_filename LIKE ? OR alt_text LIKE ? OR description LIKE ?", like, like, like, like)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	err := query.Order("created_at DESC, id DESC").
		Offset(offset).
		Limit(limit).
		Find(&rows).Error
	return rows, total, err
}

func (r *Repository) Asset(projectID uint64, publicID string) (*storytellerModel.Asset, error) {
	var row storytellerModel.Asset
	err := r.db.Where("project_id = ? AND public_id = ? AND is_deleted = 0 AND deleted_at IS NULL", projectID, publicID).
		First(&row).Error
	return &row, err
}

func (r *Repository) AssetsByPublicIDs(projectID uint64, publicIDs []string) ([]storytellerModel.Asset, error) {
	rows := make([]storytellerModel.Asset, 0)
	if len(publicIDs) == 0 {
		return rows, nil
	}
	err := r.db.Where("project_id = ? AND public_id IN ? AND is_deleted = 0 AND deleted_at IS NULL", projectID, publicIDs).
		Find(&rows).Error
	return rows, err
}

func (r *Repository) AssetByS3Key(projectID uint64, key string) (*storytellerModel.Asset, error) {
	var row storytellerModel.Asset
	err := r.db.Where("project_id = ? AND s3_key = ? AND is_deleted = 0 AND deleted_at IS NULL", projectID, key).
		First(&row).Error
	return &row, err
}

func (r *Repository) CreateAsset(row *storytellerModel.Asset) error {
	return r.db.Create(row).Error
}

func (r *Repository) UpdateAsset(row *storytellerModel.Asset) error {
	return r.db.Model(row).Updates(map[string]any{
		"title":       row.Title,
		"alt_text":    row.AltText,
		"description": row.Description,
		"metadata":    row.Metadata,
	}).Error
}

func (r *Repository) MoveAsset(row *storytellerModel.Asset) error {
	return r.db.Model(row).Update("collection_id", row.CollectionID).Error
}

func (r *Repository) DeleteAsset(row *storytellerModel.Asset) error {
	now := time.Now()
	return r.db.Model(row).Updates(map[string]any{"is_deleted": true, "deleted_at": &now}).Error
}

func (r *Repository) AssetReferenceCount(assetID uint64) (int64, error) {
	var count int64
	err := r.db.Model(&storytellerModel.AssetReference{}).
		Where("asset_id = ?", assetID).
		Count(&count).Error
	return count, err
}

func (r *Repository) AssetReferenceCounts(assetIDs []uint64) (map[uint64]int64, error) {
	counts := make(map[uint64]int64)
	if len(assetIDs) == 0 {
		return counts, nil
	}
	var rows []struct {
		AssetID uint64
		Count   int64
	}
	if err := r.db.Model(&storytellerModel.AssetReference{}).
		Select("asset_id, COUNT(*) AS count").
		Where("asset_id IN ?", assetIDs).
		Group("asset_id").
		Scan(&rows).Error; err != nil {
		return nil, err
	}
	for _, row := range rows {
		counts[row.AssetID] = row.Count
	}
	return counts, nil
}

func (r *Repository) ReplaceAssetReferences(targetType string, targetID uint64, rows []storytellerModel.AssetReference) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("target_type = ? AND target_id = ?", targetType, targetID).
			Delete(&storytellerModel.AssetReference{}).Error; err != nil {
			return err
		}
		if len(rows) == 0 {
			return nil
		}
		return tx.Create(&rows).Error
	})
}

func (r *Repository) SaveImageStoryAssetBackfill(story *storytellerModel.Story, references []storytellerModel.AssetReference) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(story).UpdateColumn("latest_content", story.LatestContent).Error; err != nil {
			return err
		}
		if story.LatestVersionID != nil {
			if err := tx.Model(&storytellerModel.StoryVersion{}).
				Where("id = ? AND story_id = ? AND deleted_at IS NULL", *story.LatestVersionID, story.ID).
				UpdateColumn("content", story.LatestContent).Error; err != nil {
				return err
			}
		}
		if err := tx.Where("target_type = ? AND target_id = ?", "image_story", story.ID).
			Delete(&storytellerModel.AssetReference{}).Error; err != nil {
			return err
		}
		if len(references) == 0 {
			return nil
		}
		return tx.Create(&references).Error
	})
}

func (r *Repository) AssetCollections(projectID uint64) ([]storytellerModel.AssetCollection, error) {
	rows := make([]storytellerModel.AssetCollection, 0)
	err := r.db.Where("project_id = ? AND is_deleted = 0 AND deleted_at IS NULL", projectID).
		Order("sort ASC, id ASC").
		Find(&rows).Error
	return rows, err
}

func (r *Repository) AssetCollection(projectID uint64, publicID string) (*storytellerModel.AssetCollection, error) {
	var row storytellerModel.AssetCollection
	err := r.db.Where("project_id = ? AND public_id = ? AND is_deleted = 0 AND deleted_at IS NULL", projectID, publicID).
		First(&row).Error
	return &row, err
}

func (r *Repository) CreateAssetCollection(row *storytellerModel.AssetCollection) error {
	return r.db.Create(row).Error
}

func (r *Repository) UpdateAssetCollection(row *storytellerModel.AssetCollection) error {
	return r.db.Model(row).Updates(map[string]any{"name": row.Name, "description": row.Description, "sort": row.Sort}).Error
}

func (r *Repository) DeleteAssetCollection(row *storytellerModel.AssetCollection) error {
	now := time.Now()
	return r.db.Model(row).Updates(map[string]any{"is_deleted": true, "deleted_at": &now}).Error
}

func (r *Repository) AssetCollectionAssetCount(collectionID uint64) (int64, error) {
	var count int64
	err := r.db.Model(&storytellerModel.Asset{}).
		Where("collection_id = ? AND is_deleted = 0 AND deleted_at IS NULL", collectionID).
		Count(&count).Error
	return count, err
}

func (r *Repository) AssetCollectionAssetCounts(collectionIDs []uint64) (map[uint64]int64, error) {
	counts := make(map[uint64]int64)
	if len(collectionIDs) == 0 {
		return counts, nil
	}
	var rows []struct {
		CollectionID uint64
		Count        int64
	}
	if err := r.db.Model(&storytellerModel.Asset{}).
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
