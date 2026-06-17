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
	err := r.db.Where("status = ? AND deleted_at IS NULL AND index_paused_at IS NULL", "approved").Order("id ASC").Find(&brands).Error
	return brands, err
}

func (r *YouTubeRepository) SearchBrands(input erogeModel.BrandSearchRequest) ([]erogeModel.Brand, int64, error) {
	query := r.db.Model(&erogeModel.Brand{})
	status := strings.TrimSpace(input.Status)
	if status == "deleted" {
		query = query.Where("deleted_at IS NOT NULL")
	} else if status == "paused" {
		query = query.Where("deleted_at IS NULL AND index_paused_at IS NOT NULL")
	} else {
		query = query.Where("deleted_at IS NULL")
	}
	if status == "" {
		status = "approved"
	}
	if status != "all" && status != "deleted" && status != "paused" {
		query = query.Where("status = ?", status)
	}
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
	if err := r.db.Where("public_id = ? AND status = ? AND deleted_at IS NULL", publicID, "approved").First(&brand).Error; err != nil {
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

func (r *YouTubeRepository) CreatePendingBrand(brand *erogeModel.Brand) (bool, error) {
	result := r.db.Clauses(clause.OnConflict{DoNothing: true}).Create(brand)
	return result.RowsAffected > 0, result.Error
}

func (r *YouTubeRepository) UpdateBrandStatus(brandID, adminUserID uint64, status string) error {
	updates := map[string]any{"status": status}
	if status == "approved" {
		now := time.Now()
		updates["approved_by_user_id"] = adminUserID
		updates["approved_at"] = now
	}
	return r.db.Model(&erogeModel.Brand{}).Where("id = ?", brandID).Updates(updates).Error
}

func (r *YouTubeRepository) SearchVideos(
	brandPublicID string,
	input erogeModel.VideoSearchRequest,
	from *time.Time,
	to *time.Time,
) ([]erogeModel.VideoOutput, int64, error) {
	query := r.db.Table("eroge_videos AS videos").
		Joins("JOIN eroge_brands AS brands ON brands.id = videos.brand_id").
		Where("brands.status = ? AND brands.deleted_at IS NULL AND videos.deleted_at IS NULL", "approved")
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
		Where("brands.status = ? AND brands.deleted_at IS NULL AND videos.deleted_at IS NULL", "approved").
		Where("videos.youtube_video_id = ?", videoID)
	if brandPublicID != "" {
		query = query.Where("brands.public_id = ?", brandPublicID)
	}
	if err := query.Take(&video).Error; err != nil {
		return nil, err
	}
	return &video, nil
}

func (r *YouTubeRepository) VideosForDurationBackfill() ([]erogeModel.VideoOutput, error) {
	videos := make([]erogeModel.VideoOutput, 0)
	err := r.db.Table("eroge_videos AS videos").
		Select("videos.*, brands.name AS brand_name, brands.public_id AS brand_public_id, brands.avatar_url AS brand_avatar_url, brands.youtube_channel_id AS youtube_channel_id").
		Joins("JOIN eroge_brands AS brands ON brands.id = videos.brand_id").
		Where("videos.youtube_info IS NOT NULL AND videos.youtube_info <> ''").
		Where("videos.duration_seconds = 0").
		Order("videos.id ASC").
		Scan(&videos).Error
	return videos, err
}

func (r *YouTubeRepository) UpdateVideoDuration(videoID uint64, durationSeconds uint64) error {
	return r.db.Model(&erogeModel.Video{}).
		Where("id = ?", videoID).
		Update("duration_seconds", durationSeconds).Error
}

func (r *YouTubeRepository) RelatedVideoCandidates(video erogeModel.VideoOutput) ([]erogeModel.VideoOutput, error) {
	candidates := make([]erogeModel.VideoOutput, 0, 200)
	base := func() *gorm.DB {
		return r.db.Session(&gorm.Session{NewDB: true}).
			Table("eroge_videos AS videos").
			Select("videos.*, brands.name AS brand_name, brands.public_id AS brand_public_id, brands.avatar_url AS brand_avatar_url").
			Joins("JOIN eroge_brands AS brands ON brands.id = videos.brand_id").
			Where("brands.status = ? AND brands.deleted_at IS NULL AND videos.deleted_at IS NULL", "approved").
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

func (r *YouTubeRepository) AdjacentVideos(video erogeModel.VideoOutput) (*erogeModel.VideoOutput, *erogeModel.VideoOutput, error) {
	base := func() *gorm.DB {
		return r.db.Table("eroge_videos AS videos").
			Select("videos.*, brands.name AS brand_name, brands.public_id AS brand_public_id, brands.avatar_url AS brand_avatar_url").
			Joins("JOIN eroge_brands AS brands ON brands.id = videos.brand_id").
			Where("videos.brand_id = ? AND brands.status = ? AND brands.deleted_at IS NULL AND videos.deleted_at IS NULL", video.BrandID, "approved")
	}

	var previous erogeModel.VideoOutput
	previousQuery := base().
		Where("(videos.published_at < ? OR (videos.published_at = ? AND videos.id < ?))", video.PublishedAt, video.PublishedAt, video.ID).
		Order("videos.published_at DESC, videos.id DESC").
		Take(&previous)
	if previousQuery.Error != nil && previousQuery.Error != gorm.ErrRecordNotFound {
		return nil, nil, previousQuery.Error
	}

	var next erogeModel.VideoOutput
	nextQuery := base().
		Where("(videos.published_at > ? OR (videos.published_at = ? AND videos.id > ?))", video.PublishedAt, video.PublishedAt, video.ID).
		Order("videos.published_at ASC, videos.id ASC").
		Take(&next)
	if nextQuery.Error != nil && nextQuery.Error != gorm.ErrRecordNotFound {
		return nil, nil, nextQuery.Error
	}

	var previousOutput, nextOutput *erogeModel.VideoOutput
	if previousQuery.Error == nil {
		previousOutput = &previous
	}
	if nextQuery.Error == nil {
		nextOutput = &next
	}
	return previousOutput, nextOutput, nil
}

func (r *YouTubeRepository) BrandFavorite(userID, brandID uint64) (bool, error) {
	var count int64
	err := r.db.Model(&erogeModel.BrandFavorite{}).
		Where("user_id = ? AND brand_id = ?", userID, brandID).
		Count(&count).Error
	return count > 0, err
}

func (r *YouTubeRepository) SetBrandFavorite(userID, brandID uint64, favorite bool) error {
	value := erogeModel.BrandFavorite{UserID: userID, BrandID: brandID}
	if favorite {
		return r.db.Clauses(clause.OnConflict{DoNothing: true}).Create(&value).Error
	}
	return r.db.Where("user_id = ? AND brand_id = ?", userID, brandID).Delete(&value).Error
}

func (r *YouTubeRepository) VideoFavorite(userID, videoID uint64) (bool, error) {
	var count int64
	err := r.db.Model(&erogeModel.VideoFavorite{}).
		Where("user_id = ? AND video_id = ?", userID, videoID).
		Count(&count).Error
	return count > 0, err
}

func (r *YouTubeRepository) SetVideoFavorite(userID, videoID uint64, favorite bool) error {
	value := erogeModel.VideoFavorite{UserID: userID, VideoID: videoID}
	if favorite {
		return r.db.Clauses(clause.OnConflict{DoNothing: true}).Create(&value).Error
	}
	return r.db.Where("user_id = ? AND video_id = ?", userID, videoID).Delete(&value).Error
}

func (r *YouTubeRepository) VideoReaction(userID, videoID uint64) (string, error) {
	var event erogeModel.VideoReactionEvent
	err := r.db.Where("user_id = ? AND video_id = ?", userID, videoID).
		Order("created_at DESC, id DESC").
		Take(&event).Error
	if err == gorm.ErrRecordNotFound {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	switch event.Action {
	case erogeModel.VideoReactionLike:
		return "like", nil
	case erogeModel.VideoReactionDislike:
		return "dislike", nil
	default:
		return "", nil
	}
}

func (r *YouTubeRepository) SetVideoReaction(userID uint64, video erogeModel.VideoOutput, action erogeModel.VideoReactionAction) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		event := erogeModel.VideoReactionEvent{UserID: userID, VideoID: video.ID, Action: action}
		if err := tx.Create(&event).Error; err != nil {
			return err
		}
		switch action {
		case erogeModel.VideoReactionLike:
			return tx.Model(&erogeModel.Video{}).Where("id = ?", video.ID).
				UpdateColumn("likes", gorm.Expr("likes + 1")).Error
		case erogeModel.VideoReactionDislike:
			return tx.Model(&erogeModel.Video{}).Where("id = ?", video.ID).
				UpdateColumn("dislikes", gorm.Expr("dislikes + 1")).Error
		case erogeModel.VideoReactionCancelLike:
			return tx.Model(&erogeModel.Video{}).Where("id = ?", video.ID).
				UpdateColumn("likes", gorm.Expr("IF(likes > 0, likes - 1, 0)")).Error
		case erogeModel.VideoReactionCancelDislike:
			return tx.Model(&erogeModel.Video{}).Where("id = ?", video.ID).
				UpdateColumn("dislikes", gorm.Expr("IF(dislikes > 0, dislikes - 1, 0)")).Error
		default:
			return nil
		}
	})
}

func (r *YouTubeRepository) FavoriteStatus(userID uint64, brandIDs, videoIDs []uint64) ([]uint64, []uint64, error) {
	favoriteBrandIDs := make([]uint64, 0)
	if len(brandIDs) > 0 {
		if err := r.db.Model(&erogeModel.BrandFavorite{}).
			Where("user_id = ? AND brand_id IN ?", userID, brandIDs).
			Pluck("brand_id", &favoriteBrandIDs).Error; err != nil {
			return nil, nil, err
		}
	}
	favoriteVideoIDs := make([]uint64, 0)
	if len(videoIDs) > 0 {
		if err := r.db.Model(&erogeModel.VideoFavorite{}).
			Where("user_id = ? AND video_id IN ?", userID, videoIDs).
			Pluck("video_id", &favoriteVideoIDs).Error; err != nil {
			return nil, nil, err
		}
	}
	return favoriteBrandIDs, favoriteVideoIDs, nil
}

func (r *YouTubeRepository) FavoriteBrands(userID uint64, input erogeModel.BrandSearchRequest) ([]erogeModel.Brand, int64, error) {
	query := r.db.Table("eroge_brands AS brands").
		Joins("JOIN eroge_brand_favorites AS favorites ON favorites.brand_id = brands.id").
		Where("favorites.user_id = ? AND brands.status = ?", userID, "approved")
	if keyword := strings.TrimSpace(input.Keyword); keyword != "" {
		query = query.Where("brands.name LIKE ?", "%"+keyword+"%")
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	brands := make([]erogeModel.Brand, 0)
	err := query.Select(`brands.*,
		(
			SELECT COUNT(*)
			FROM eroge_videos AS latest_videos
			WHERE latest_videos.brand_id = brands.id
				AND latest_videos.deleted_at IS NULL
				AND latest_videos.published_at >= DATE_SUB(UTC_TIMESTAMP(), INTERVAL 1 DAY)
		) AS latest_video_count`).
		Order("favorites.created_at DESC").
		Offset(int((input.PageValue() - 1) * input.PerPageValue())).
		Limit(int(input.PerPageValue())).
		Scan(&brands).Error
	return brands, total, err
}

func (r *YouTubeRepository) FavoriteVideos(userID uint64, input erogeModel.VideoSearchRequest) ([]erogeModel.VideoOutput, int64, error) {
	query := r.db.Table("eroge_videos AS videos").
		Select("videos.*, brands.name AS brand_name, brands.public_id AS brand_public_id, brands.avatar_url AS brand_avatar_url").
		Joins("JOIN eroge_brands AS brands ON brands.id = videos.brand_id").
		Joins("JOIN eroge_video_favorites AS favorites ON favorites.video_id = videos.id").
		Where("favorites.user_id = ? AND brands.status = ?", userID, "approved")
	if keyword := strings.TrimSpace(input.Keyword); keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("(videos.title LIKE ? OR videos.description LIKE ?)", like, like)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	videos := make([]erogeModel.VideoOutput, 0)
	err := query.Order("favorites.created_at DESC").
		Offset(int((input.PageValue() - 1) * input.PerPageValue())).
		Limit(int(input.PerPageValue())).
		Scan(&videos).Error
	return videos, total, err
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
			"brand_id", "title", "tags", "thumbnail_url", "description", "published_at", "duration_seconds", "youtube_info", "updated_at",
		}),
	}).Create(video).Error
}

func (r *YouTubeRepository) MarkVideoSync(brandID uint64, syncedAt time.Time) error {
	return r.db.Model(&erogeModel.Brand{}).Where("id = ?", brandID).
		Update("last_video_synced_at", syncedAt).Error
}

func (r *YouTubeRepository) ClearVideoSyncCursor(brandID uint64) error {
	return r.db.Model(&erogeModel.Brand{}).Where("id = ?", brandID).
		Update("last_video_synced_at", nil).Error
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

func (r *YouTubeRepository) SoftDeleteBrand(brandID uint64, deletedAt time.Time) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&erogeModel.Video{}).Where("brand_id = ?", brandID).Update("deleted_at", deletedAt).Error; err != nil {
			return err
		}
		return tx.Model(&erogeModel.Brand{}).Where("id = ?", brandID).Updates(map[string]any{
			"deleted_at": deletedAt, "index_paused_at": nil,
		}).Error
	})
}

func (r *YouTubeRepository) RestoreBrand(brandID uint64) error {
	return r.db.Transaction(func(tx *gorm.DB) error {
		if err := tx.Model(&erogeModel.Brand{}).Where("id = ?", brandID).Update("deleted_at", nil).Error; err != nil {
			return err
		}
		return tx.Model(&erogeModel.Video{}).Where("brand_id = ?", brandID).Update("deleted_at", nil).Error
	})
}

func (r *YouTubeRepository) PauseBrandIndexing(brandID uint64, pausedAt time.Time) error {
	return r.db.Model(&erogeModel.Brand{}).Where("id = ? AND deleted_at IS NULL", brandID).
		Update("index_paused_at", pausedAt).Error
}

func (r *YouTubeRepository) ResumeBrandIndexing(brandID uint64) error {
	return r.db.Model(&erogeModel.Brand{}).Where("id = ? AND deleted_at IS NULL", brandID).
		Update("index_paused_at", nil).Error
}

func (r *YouTubeRepository) SearchAdminVideos(input erogeModel.VideoSearchRequest) ([]erogeModel.VideoOutput, int64, error) {
	query := r.db.Table("eroge_videos AS videos").
		Select("videos.*, brands.name AS brand_name, brands.public_id AS brand_public_id, brands.avatar_url AS brand_avatar_url").
		Joins("JOIN eroge_brands AS brands ON brands.id = videos.brand_id")
	if input.Status == "deleted" {
		query = query.Where("videos.deleted_at IS NOT NULL")
	} else {
		query = query.Where("videos.deleted_at IS NULL AND brands.deleted_at IS NULL")
	}
	if keyword := strings.TrimSpace(input.Keyword); keyword != "" {
		like := "%" + keyword + "%"
		query = query.Where("(videos.title LIKE ? OR videos.description LIKE ? OR brands.name LIKE ?)", like, like, like)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	videos := make([]erogeModel.VideoOutput, 0)
	err := query.Order("videos.published_at DESC, videos.id DESC").
		Offset(int((input.PageValue() - 1) * input.PerPageValue())).
		Limit(int(input.PerPageValue())).
		Scan(&videos).Error
	return videos, total, err
}

func (r *YouTubeRepository) VideoByID(videoID uint64) (*erogeModel.Video, error) {
	var video erogeModel.Video
	if err := r.db.First(&video, videoID).Error; err != nil {
		return nil, err
	}
	return &video, nil
}

func (r *YouTubeRepository) VideoByYouTubeVideoID(videoID string) (*erogeModel.Video, error) {
	var video erogeModel.Video
	if err := r.db.Where("youtube_video_id = ?", videoID).First(&video).Error; err != nil {
		return nil, err
	}
	return &video, nil
}

func (r *YouTubeRepository) SoftDeleteVideo(videoID uint64, deletedAt time.Time) error {
	return r.db.Model(&erogeModel.Video{}).Where("id = ?", videoID).Update("deleted_at", deletedAt).Error
}

func (r *YouTubeRepository) RestoreVideo(videoID uint64) error {
	return r.db.Model(&erogeModel.Video{}).Where("id = ?", videoID).Update("deleted_at", nil).Error
}

func (r *YouTubeRepository) CreateVideoSubmission(submission *erogeModel.VideoSubmission) (bool, error) {
	result := r.db.Clauses(clause.OnConflict{DoNothing: true}).Create(submission)
	return result.RowsAffected > 0, result.Error
}

func (r *YouTubeRepository) VideoSubmissionByYouTubeVideoID(videoID string) (*erogeModel.VideoSubmission, error) {
	var submission erogeModel.VideoSubmission
	if err := r.db.Where("youtube_video_id = ?", videoID).First(&submission).Error; err != nil {
		return nil, err
	}
	return &submission, nil
}

func (r *YouTubeRepository) SearchVideoSubmissions(input erogeModel.VideoSubmissionSearchRequest) ([]erogeModel.VideoSubmission, int64, error) {
	query := r.db.Model(&erogeModel.VideoSubmission{})
	status := strings.TrimSpace(input.Status)
	if status == "" {
		status = "pending"
	}
	if status != "all" {
		query = query.Where("status = ?", status)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	rows := make([]erogeModel.VideoSubmission, 0)
	err := query.Order("created_at ASC").
		Offset(int((input.PageValue() - 1) * input.PerPageValue())).
		Limit(int(input.PerPageValue())).
		Find(&rows).Error
	return rows, total, err
}

func (r *YouTubeRepository) VideoSubmissionByID(id uint64) (*erogeModel.VideoSubmission, error) {
	var submission erogeModel.VideoSubmission
	if err := r.db.First(&submission, id).Error; err != nil {
		return nil, err
	}
	return &submission, nil
}

func (r *YouTubeRepository) UpdateVideoSubmissionStatus(id, adminUserID uint64, status, errorMessage string) error {
	now := time.Now()
	return r.db.Model(&erogeModel.VideoSubmission{}).Where("id = ?", id).Updates(map[string]any{
		"status": status, "reviewed_by_user_id": adminUserID, "reviewed_at": now, "error_message": errorMessage,
	}).Error
}

func (r *YouTubeRepository) EnabledVideoTitleKeywords() ([]string, error) {
	keywords := make([]string, 0)
	err := r.db.Model(&erogeModel.VideoTitleKeyword{}).
		Where("enabled = ?", true).
		Order("id ASC").
		Pluck("keyword", &keywords).Error
	return keywords, err
}

func (r *YouTubeRepository) SearchVideoTitleKeywords(input erogeModel.VideoTitleKeywordSearchRequest) ([]erogeModel.VideoTitleKeyword, int64, error) {
	query := r.db.Model(&erogeModel.VideoTitleKeyword{})
	if keyword := strings.TrimSpace(input.Keyword); keyword != "" {
		query = query.Where("keyword LIKE ?", "%"+keyword+"%")
	}
	switch strings.TrimSpace(input.Enabled) {
	case "true", "1":
		query = query.Where("enabled = ?", true)
	case "false", "0":
		query = query.Where("enabled = ?", false)
	}
	var total int64
	if err := query.Count(&total).Error; err != nil {
		return nil, 0, err
	}
	rows := make([]erogeModel.VideoTitleKeyword, 0)
	err := query.Order("keyword ASC").
		Offset(int((input.PageValue() - 1) * input.PerPageValue())).
		Limit(int(input.PerPageValue())).
		Find(&rows).Error
	return rows, total, err
}

func (r *YouTubeRepository) CreateVideoTitleKeyword(keyword string, enabled bool) (*erogeModel.VideoTitleKeyword, error) {
	row := &erogeModel.VideoTitleKeyword{Keyword: keyword, Enabled: enabled}
	if err := r.db.Create(row).Error; err != nil {
		return nil, err
	}
	return row, nil
}

func (r *YouTubeRepository) UpdateVideoTitleKeyword(id uint64, updates map[string]any) (*erogeModel.VideoTitleKeyword, error) {
	if err := r.db.Model(&erogeModel.VideoTitleKeyword{}).Where("id = ?", id).Updates(updates).Error; err != nil {
		return nil, err
	}
	var row erogeModel.VideoTitleKeyword
	if err := r.db.First(&row, id).Error; err != nil {
		return nil, err
	}
	return &row, nil
}

func (r *YouTubeRepository) DeleteVideoTitleKeyword(id uint64) error {
	return r.db.Delete(&erogeModel.VideoTitleKeyword{}, id).Error
}
