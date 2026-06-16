package eroge

import (
	"time"

	"faryne.dev/model/entity"
)

type Brand struct {
	ID                  uint64     `gorm:"column:id;primaryKey" json:"id"`
	PublicID            string     `gorm:"column:public_id" json:"public_id"`
	Name                string     `gorm:"column:name" json:"name"`
	YouTubeChannelID    string     `gorm:"column:youtube_channel_id" json:"youtube_channel_id"`
	AvatarURL           string     `gorm:"column:avatar_url" json:"avatar_url"`
	YouTubeInfo         string     `gorm:"column:youtube_info" json:"-"`
	UploadsPlaylistID   string     `gorm:"column:uploads_playlist_id" json:"uploads_playlist_id"`
	Status              string     `gorm:"column:status" json:"status"`
	SubmittedByUserID   uint64     `gorm:"column:submitted_by_user_id" json:"submitted_by_user_id"`
	ApprovedByUserID    *uint64    `gorm:"column:approved_by_user_id" json:"approved_by_user_id"`
	ApprovedAt          *time.Time `gorm:"column:approved_at" json:"approved_at"`
	LastChannelSyncedAt *time.Time `gorm:"column:last_channel_synced_at" json:"last_channel_synced_at"`
	LastVideoSyncedAt   *time.Time `gorm:"column:last_video_synced_at" json:"last_video_synced_at"`
	LatestVideoCount    uint64     `gorm:"->;column:latest_video_count" json:"-"`
	CreatedAt           time.Time  `gorm:"column:created_at" json:"created_at"`
	UpdatedAt           time.Time  `gorm:"column:updated_at" json:"updated_at"`
}

func (Brand) TableName() string { return "eroge_brands" }

type Video struct {
	ID              uint64    `gorm:"column:id;primaryKey" json:"id"`
	BrandID         uint64    `gorm:"column:brand_id" json:"brand_id"`
	YouTubeVideoID  string    `gorm:"column:youtube_video_id" json:"youtube_video_id"`
	Title           string    `gorm:"column:title" json:"title"`
	Tags            string    `gorm:"column:tags" json:"-"`
	ThumbnailURL    string    `gorm:"column:thumbnail_url" json:"thumbnail_url"`
	Description     string    `gorm:"column:description" json:"description"`
	PublishedAt     time.Time `gorm:"column:published_at" json:"published_at"`
	DurationSeconds uint64    `gorm:"column:duration_seconds" json:"duration_seconds"`
	Likes           uint64    `gorm:"column:likes" json:"likes"`
	Dislikes        uint64    `gorm:"column:dislikes" json:"dislikes"`
	YouTubeInfo     string    `gorm:"column:youtube_info" json:"-"`
	CreatedAt       time.Time `gorm:"column:created_at" json:"created_at"`
	UpdatedAt       time.Time `gorm:"column:updated_at" json:"updated_at"`
}

func (Video) TableName() string { return "eroge_videos" }

type BrandSearchRequest struct {
	entity.CommonPaginationQueryRequest
	Keyword string `query:"keyword"`
	Status  string `query:"status"`
}

type BrandLink struct {
	Label string `json:"label"`
	URL   string `json:"url"`
}

type BrandOutput struct {
	ID               uint64      `json:"id"`
	PublicID         string      `json:"public_id"`
	Name             string      `json:"name"`
	YouTubeChannelID string      `json:"youtube_channel_id"`
	AvatarURL        string      `json:"avatar_url"`
	Description      string      `json:"description"`
	CustomURL        string      `json:"custom_url"`
	SubscriberCount  uint64      `json:"subscriber_count"`
	VideoCount       uint64      `json:"video_count"`
	ViewCount        uint64      `json:"view_count"`
	LatestVideoCount uint64      `json:"latest_video_count"`
	Status           string      `json:"status"`
	Links            []BrandLink `json:"links"`
}

type BrandSubmissionRequest struct {
	Channels []string `json:"channels"`
}

type BrandSubmissionResult struct {
	Input   string       `json:"input"`
	Brand   *BrandOutput `json:"brand,omitempty"`
	Created bool         `json:"created"`
	Error   string       `json:"error,omitempty"`
}

type BrandStatusRequest struct {
	Status string `json:"status"`
}

type VideoSearchRequest struct {
	entity.CommonPaginationQueryRequest
	Keyword         string `query:"keyword"`
	PublishedAtFrom string `query:"published_at_from"`
	PublishedAtTo   string `query:"published_at_to"`
}

type VideoOutput struct {
	Video
	BrandName        string `gorm:"column:brand_name" json:"brand_name"`
	BrandPublicID    string `gorm:"column:brand_public_id" json:"brand_public_id"`
	BrandAvatarURL   string `gorm:"column:brand_avatar_url" json:"brand_avatar_url"`
	YouTubeChannelID string `gorm:"column:youtube_channel_id" json:"-"`
}

type RelatedVideoOutput struct {
	VideoOutput
	Score int `json:"-"`
}

type FavoriteStatus struct {
	Favorite bool `json:"favorite"`
}

type VideoReactionAction string

const (
	VideoReactionLike          VideoReactionAction = "like"
	VideoReactionDislike       VideoReactionAction = "dislike"
	VideoReactionCancelLike    VideoReactionAction = "cancel_like"
	VideoReactionCancelDislike VideoReactionAction = "cancel_dislike"
)

type VideoReactionStatus struct {
	Reaction string `json:"reaction"`
	Likes    uint64 `json:"likes"`
	Dislikes uint64 `json:"dislikes"`
}

type VideoReactionRequest struct {
	Action VideoReactionAction `json:"action"`
}

type FavoriteStatusRequest struct {
	BrandIDs []uint64 `json:"brand_ids"`
	VideoIDs []uint64 `json:"video_ids"`
}

type FavoriteStatusOutput struct {
	BrandIDs []uint64 `json:"brand_ids"`
	VideoIDs []uint64 `json:"video_ids"`
}

type VideoNavigationOutput struct {
	Previous *VideoOutput `json:"previous"`
	Next     *VideoOutput `json:"next"`
}

type BrandFavorite struct {
	UserID    uint64    `gorm:"column:user_id;primaryKey"`
	BrandID   uint64    `gorm:"column:brand_id;primaryKey"`
	CreatedAt time.Time `gorm:"column:created_at"`
}

func (BrandFavorite) TableName() string { return "eroge_brand_favorites" }

type VideoFavorite struct {
	UserID    uint64    `gorm:"column:user_id;primaryKey"`
	VideoID   uint64    `gorm:"column:video_id;primaryKey"`
	CreatedAt time.Time `gorm:"column:created_at"`
}

func (VideoFavorite) TableName() string { return "eroge_video_favorites" }

type VideoReactionEvent struct {
	ID        uint64              `gorm:"column:id;primaryKey"`
	UserID    uint64              `gorm:"column:user_id"`
	VideoID   uint64              `gorm:"column:video_id"`
	Action    VideoReactionAction `gorm:"column:action"`
	CreatedAt time.Time           `gorm:"column:created_at"`
}

func (VideoReactionEvent) TableName() string { return "eroge_video_reaction_events" }
