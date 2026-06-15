package eroge

import (
	"strings"
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
	brands := make([]erogeModel.Brand, 0)
	err := r.db.Order("id ASC").Find(&brands).Error
	return brands, err
}

func (r *YouTubeRepository) SearchBrands(input erogeModel.BrandSearchRequest) ([]erogeModel.Brand, int64, error) {
	query := r.db.Model(&erogeModel.Brand{})
	if keyword := strings.TrimSpace(input.Keyword); keyword != "" {
		query = query.Where("name LIKE ?", "%"+keyword+"%")
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	brands := make([]erogeModel.Brand, 0)
	err := query.Order("name ASC").
		Offset(int((input.PageValue() - 1) * input.PerPageValue())).
		Limit(int(input.PerPageValue())).
		Find(&brands).Error
	return brands, total, err
}

func (r *YouTubeRepository) Brand(publicID string) (*erogeModel.Brand, error) {
	var brand erogeModel.Brand
	if err := r.db.Where("public_id = ?", publicID).First(&brand).Error; err != nil {
		return nil, err
	}
	return &brand, nil
}

func (r *YouTubeRepository) BrandByID(id uint64) (*erogeModel.Brand, error) {
	var brand erogeModel.Brand
	if err := r.db.First(&brand, id).Error; err != nil {
		return nil, err
	}
	return &brand, nil
}

func (r *YouTubeRepository) BrandByYouTubeChannelID(channelID string) (*erogeModel.Brand, error) {
	var brand erogeModel.Brand
	if err := r.db.Where("youtube_channel_id = ?", channelID).First(&brand).Error; err != nil {
		return nil, err
	}
	return &brand, nil
}

func (r *YouTubeRepository) SearchVideos(
	brandPublicID string,
	input erogeModel.VideoSearchRequest,
	from *time.Time,
	to *time.Time,
) ([]erogeModel.VideoOutput, int64, error) {
	query := r.db.Table("eroge_videos AS videos").
		Joins("JOIN eroge_brands AS brands ON brands.id = videos.brand_id")
	if brandPublicID != "" {
		query = query.Where("brands.public_id = ?", brandPublicID)
	}
	if keyword := strings.TrimSpace(input.Keyword); keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("(videos.title LIKE ? OR videos.description LIKE ?)", like, like)
	}
	if from != nil {
		query = query.Where("videos.published_at >= ?", *from)
	}
	if to != nil {
		query = query.Where("videos.published_at < ?", *to)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	videos := make([]erogeModel.VideoOutput, 0)
	err := query.Select("videos.*, brands.name AS brand_name, brands.public_id AS brand_public_id, brands.avatar_url AS brand_avatar_url").
		Order("videos.published_at DESC, videos.id DESC").
		Offset(int((input.PageValue() - 1) * input.PerPageValue())).
		Limit(int(input.PerPageValue())).
		Scan(&videos).Error
	return videos, total, err
}

func (r *YouTubeRepository) Video(brandPublicID string, videoID string) (*erogeModel.VideoOutput, error) {
	var video erogeModel.VideoOutput
	query := r.db.Table("eroge_videos AS videos").
		Select("videos.*, brands.name AS brand_name, brands.public_id AS brand_public_id, brands.avatar_url AS brand_avatar_url").
		Joins("JOIN eroge_brands AS brands ON brands.id = videos.brand_id").
		Where("videos.youtube_video_id = ?", videoID)
	if brandPublicID != "" {
		query = query.Where("brands.public_id = ?", brandPublicID)
	}
	if err := query.Take(&video).Error; err != nil {
		return nil, err
	}
	return &video, nil
}

func (r *YouTubeRepository) RelatedVideoCandidates(video erogeModel.VideoOutput) ([]erogeModel.VideoOutput, error) {
	candidates := make([]erogeModel.VideoOutput, 0, 200)
	base := func() *gorm.DB {
		return r.db.Session(&gorm.Session{NewDB: true}).
			Table("eroge_videos AS videos").
			Select("videos.*, brands.name AS brand_name, brands.public_id AS brand_public_id, brands.avatar_url AS brand_avatar_url").
			Joins("JOIN eroge_brands AS brands ON brands.id = videos.brand_id").
			Where("videos.youtube_video_id <> ?", video.YouTubeVideoID)
	}

	sameBrand := make([]erogeModel.VideoOutput, 0, 50)
	if err := base().Where("videos.brand_id = ?", video.BrandID).
		Order("videos.published_at DESC").
		Limit(50).
		Scan(&sameBrand).Error; err != nil {
		return nil, err
	}
	candidates = append(candidates, sameBrand...)

	otherBrands := make([]erogeModel.VideoOutput, 0, 150)
	if err := base().Where("videos.brand_id <> ?", video.BrandID).
		Order("videos.published_at DESC").
		Limit(150).
		Scan(&otherBrands).Error; err != nil {
		return nil, err
	}
	return append(candidates, otherBrands...), nil
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

func (r *YouTubeRepository) VideoIDsByBrand(brandID uint64) ([]string, error) {
	ids := make([]string, 0)
	err := r.db.Model(&erogeModel.Video{}).
		Where("brand_id = ?", brandID).
		Pluck("youtube_video_id", &ids).Error
	return ids, err
}

func (r *YouTubeRepository) ReplaceBrandChannel(
	brandID uint64,
	name string,
	channelID string,
	avatar string,
	uploads string,
	info string,
	syncedAt time.Time,
) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Where("brand_id = ?", brandID).Delete(&erogeModel.Video{}).Error; err != nil {
			return err
		}
		return tx.Model(&erogeModel.Brand{}).Where("id = ?", brandID).Updates(map[string]any{
			"name": name, "youtube_channel_id": channelID, "avatar_url": avatar,
			"uploads_playlist_id": uploads, "youtube_info": info,
			"last_channel_synced_at": syncedAt, "last_video_synced_at": nil,
		}).Error
	})
}

func (r *YouTubeRepository) HardDeleteBrand(brandID uint64) error {
	return r.db.Unscoped().Delete(&erogeModel.Brand{}, brandID).Error
}
