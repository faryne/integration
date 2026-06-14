package eroge

import (
	"time"

	erogeModel "faryne.dev/model/entity/eroge"
	"faryne.dev/model/enum"
	"faryne.dev/service/client"
	"gorm.io/gorm"
	"gorm.io/gorm/clause"
)

type YouTubeRepository struct{ db *gorm.DB }

func NewYouTubeRepository() *YouTubeRepository {
	return &YouTubeRepository{db: client.GetDB(enum.DBWalolita)}
}

func (r *YouTubeRepository) Brands() ([]erogeModel.Brand, error) {
	var brands []erogeModel.Brand
	err := r.db.Order("id ASC").Find(&brands).Error
	return brands, err
}

func (r *YouTubeRepository) UpsertBrand(brand *erogeModel.Brand) error {
	return r.db.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "youtube_channel_id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"name", "avatar_url", "youtube_info", "uploads_playlist_id", "last_channel_synced_at", "updated_at",
		}),
	}).Create(brand).Error
}

func (r *YouTubeRepository) UpdateBrandChannel(brandID uint64, avatar, uploads, info string, syncedAt time.Time) error {
	return r.db.Model(&erogeModel.Brand{}).Where("id = ?", brandID).Updates(map[string]any{
		"avatar_url": avatar, "uploads_playlist_id": uploads, "youtube_info": info,
		"last_channel_synced_at": syncedAt,
	}).Error
}

func (r *YouTubeRepository) UpsertVideo(video *erogeModel.Video) error {
	return r.db.Clauses(clause.OnConflict{
		Columns: []clause.Column{{Name: "youtube_video_id"}},
		DoUpdates: clause.AssignmentColumns([]string{
			"brand_id", "title", "tags", "thumbnail_url", "description", "published_at", "youtube_info", "updated_at",
		}),
	}).Create(video).Error
}

func (r *YouTubeRepository) MarkVideoSync(brandID uint64, syncedAt time.Time) error {
	return r.db.Model(&erogeModel.Brand{}).Where("id = ?", brandID).
		Update("last_video_synced_at", syncedAt).Error
}
