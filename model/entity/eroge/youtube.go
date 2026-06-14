package eroge

import "time"

type Brand struct {
	ID                  uint64     `gorm:"column:id;primaryKey" json:"id"`
	Name                string     `gorm:"column:name" json:"name"`
	YouTubeChannelID    string     `gorm:"column:youtube_channel_id" json:"youtube_channel_id"`
	AvatarURL           string     `gorm:"column:avatar_url" json:"avatar_url"`
	YouTubeInfo         string     `gorm:"column:youtube_info" json:"-"`
	UploadsPlaylistID   string     `gorm:"column:uploads_playlist_id" json:"uploads_playlist_id"`
	LastChannelSyncedAt *time.Time `gorm:"column:last_channel_synced_at" json:"last_channel_synced_at"`
	LastVideoSyncedAt   *time.Time `gorm:"column:last_video_synced_at" json:"last_video_synced_at"`
	CreatedAt           time.Time  `gorm:"column:created_at" json:"created_at"`
	UpdatedAt           time.Time  `gorm:"column:updated_at" json:"updated_at"`
}

func (Brand) TableName() string { return "eroge_brands" }

type Video struct {
	ID             uint64    `gorm:"column:id;primaryKey" json:"id"`
	BrandID        uint64    `gorm:"column:brand_id" json:"brand_id"`
	YouTubeVideoID string    `gorm:"column:youtube_video_id" json:"youtube_video_id"`
	Title          string    `gorm:"column:title" json:"title"`
	Tags           string    `gorm:"column:tags" json:"-"`
	ThumbnailURL   string    `gorm:"column:thumbnail_url" json:"thumbnail_url"`
	Description    string    `gorm:"column:description" json:"description"`
	PublishedAt    time.Time `gorm:"column:published_at" json:"published_at"`
	YouTubeInfo    string    `gorm:"column:youtube_info" json:"-"`
	CreatedAt      time.Time `gorm:"column:created_at" json:"created_at"`
	UpdatedAt      time.Time `gorm:"column:updated_at" json:"updated_at"`
}

func (Video) TableName() string { return "eroge_videos" }
