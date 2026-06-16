package eroge

import (
	"bytes"
	"context"
	"crypto/rand"
	"encoding/csv"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"regexp"
	"strconv"
	"strings"
	"time"

	"faryne.dev/config"
	erogeModel "faryne.dev/model/entity/eroge"
	"faryne.dev/model/enum"
	erogeRepo "faryne.dev/repository/eroge"
	"faryne.dev/service/client"
	"faryne.dev/service/log"
	"go.uber.org/zap"
	"google.golang.org/api/googleapi"
	"google.golang.org/api/option"
	"google.golang.org/api/youtube/v3"
)

const (
	brandIndexName = "galgame_brands"
	videoIndexName = "galgame_videos"
)

var videoTitleKeywords = []string{
	"PV",
	"OP",
	"OPムービー",
	"オープニング",
	"オープニングムービー",
	"プロモーション",
	"プロモーションムービー",
	"ティザー",
	"体験版",
	"デモムービー",
	"発売記念",
	"エンディング",
	"ＯＰムービー",
}

var youtubeDurationPattern = regexp.MustCompile(`^P(?:\d+W)?(?:\d+D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$`)

type SyncResult struct {
	Brands, Fetched, Matched, Saved, Indexed, Failed int
}

type BrandInput struct {
	Name       string
	ChannelRef string
}

type Service struct {
	repo     *erogeRepo.YouTubeRepository
	youtube  *youtube.Service
	keywords []string
}

func NewService(ctx context.Context) (*Service, error) {
	key := strings.TrimSpace(config.EnvConfig().YouTubeAPIKey)
	if key == "" {
		return nil, fmt.Errorf("YOUTUBE_API_KEY is required")
	}
	api, err := youtube.NewService(ctx, option.WithAPIKey(key))
	if err != nil {
		return nil, err
	}
	keywords := make([]string, 0, len(videoTitleKeywords))
	for _, keyword := range videoTitleKeywords {
		if keyword = strings.TrimSpace(keyword); keyword != "" {
			keywords = append(keywords, strings.ToLower(keyword))
		}
	}
	return &Service{repo: erogeRepo.NewYouTubeRepository(), youtube: api, keywords: keywords}, nil
}

func (s *Service) AddBrand(ctx context.Context, input BrandInput) (*erogeModel.Brand, error) {
	input.Name = strings.TrimSpace(input.Name)
	input.ChannelRef = strings.TrimSpace(input.ChannelRef)
	if input.Name == "" {
		return nil, fmt.Errorf("brand name is required")
	}
	if input.ChannelRef == "" {
		return nil, fmt.Errorf("youtube channel ID or handle is required")
	}

	call := s.youtube.Channels.List([]string{"snippet", "contentDetails", "statistics"})
	if strings.HasPrefix(input.ChannelRef, "@") {
		call = call.ForHandle(strings.TrimPrefix(input.ChannelRef, "@"))
	} else if strings.HasPrefix(input.ChannelRef, "UC") {
		call = call.Id(input.ChannelRef)
	} else {
		return nil, fmt.Errorf("youtube channel must be an @handle or UC... channel ID")
	}

	resp, err := call.Context(ctx).Do()
	if err != nil {
		return nil, fmt.Errorf("resolve youtube channel %s: %w", input.ChannelRef, err)
	}
	if len(resp.Items) != 1 {
		return nil, fmt.Errorf("youtube channel %s not found", input.ChannelRef)
	}
	channel := resp.Items[0]
	if channel.Snippet == nil || channel.ContentDetails == nil || channel.ContentDetails.RelatedPlaylists == nil {
		return nil, fmt.Errorf("youtube channel %s returned incomplete metadata", input.ChannelRef)
	}
	raw, err := json.Marshal(channel)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	publicID, err := newBrandPublicID()
	if err != nil {
		return nil, err
	}
	brand := &erogeModel.Brand{
		PublicID: publicID, Name: input.Name, YouTubeChannelID: channel.Id,
		AvatarURL:   thumbnailURL(channel.Snippet.Thumbnails),
		YouTubeInfo: string(raw), UploadsPlaylistID: channel.ContentDetails.RelatedPlaylists.Uploads,
		Status:              "approved",
		LastChannelSyncedAt: &now, UpdatedAt: now,
	}
	if err := s.repo.UpsertBrand(brand); err != nil {
		return nil, err
	}
	savedBrand, err := s.repo.BrandByYouTubeChannelID(channel.Id)
	if err != nil {
		return nil, err
	}
	if err := indexBrand(ctx, *savedBrand); err != nil {
		return nil, err
	}
	return savedBrand, nil
}

func (s *Service) SubmitBrands(ctx context.Context, userID uint64, channels []string) ([]erogeModel.BrandSubmissionResult, error) {
	results := make([]erogeModel.BrandSubmissionResult, 0, len(channels))
	for _, rawInput := range channels {
		input := strings.TrimSpace(rawInput)
		if input == "" {
			continue
		}
		result := erogeModel.BrandSubmissionResult{Input: input}
		channelRef, err := youtubeChannelRef(input)
		if err != nil {
			result.Error = err.Error()
			results = append(results, result)
			continue
		}
		channel, err := s.resolveChannel(ctx, channelRef)
		if err != nil {
			result.Error = err.Error()
			results = append(results, result)
			continue
		}
		brand, created, err := s.createPendingBrand(ctx, userID, channel)
		if err != nil {
			result.Error = err.Error()
			results = append(results, result)
			continue
		}
		output := buildBrandOutput(*brand)
		result.Brand = &output
		result.Created = created
		results = append(results, result)
	}
	return results, nil
}

func newBrandPublicID() (string, error) {
	value := make([]byte, 16)
	if _, err := rand.Read(value); err != nil {
		return "", fmt.Errorf("generate brand public ID: %w", err)
	}
	return fmt.Sprintf("%x", value), nil
}

func (s *Service) UpdateBrand(ctx context.Context, brandID uint64, youtubeURL string) (*erogeModel.Brand, error) {
	_, err := s.repo.BrandByID(brandID)
	if err != nil {
		return nil, err
	}
	channelRef, err := youtubeChannelRefFromURL(youtubeURL)
	if err != nil {
		return nil, err
	}
	channel, err := s.resolveChannel(ctx, channelRef)
	if err != nil {
		return nil, err
	}
	videoIDs, err := s.repo.VideoIDsByBrand(brandID)
	if err != nil {
		return nil, err
	}
	if err := deleteIndexDocuments(ctx, videoIndexName, videoIDs); err != nil {
		return nil, err
	}
	raw, err := json.Marshal(channel)
	if err != nil {
		return nil, err
	}
	now := time.Now()
	if err := s.repo.ReplaceBrandChannel(
		brandID,
		channel.Snippet.Title,
		channel.Id,
		thumbnailURL(channel.Snippet.Thumbnails),
		channel.ContentDetails.RelatedPlaylists.Uploads,
		string(raw),
		now,
	); err != nil {
		return nil, err
	}
	updated, err := s.repo.BrandByID(brandID)
	if err != nil {
		return nil, err
	}
	if err := indexBrand(ctx, *updated); err != nil {
		return nil, err
	}
	return updated, nil
}

func (s *Service) DeleteBrand(ctx context.Context, brandID uint64) error {
	brand, err := s.repo.BrandByID(brandID)
	if err != nil {
		return err
	}
	videoIDs, err := s.repo.VideoIDsByBrand(brandID)
	if err != nil {
		return err
	}
	if err := deleteIndexDocuments(ctx, videoIndexName, videoIDs); err != nil {
		return err
	}
	if err := deleteIndexDocuments(ctx, brandIndexName, []string{brand.PublicID}); err != nil {
		return err
	}
	return s.repo.HardDeleteBrand(brandID)
}

func (s *Service) ImportPlaylistBrands(ctx context.Context, playlistValue string) (*SyncResult, error) {
	playlistID, err := youtubePlaylistID(playlistValue)
	if err != nil {
		return nil, err
	}
	channelIDs := make(map[string]struct{})
	pageToken := ""
	result := &SyncResult{}
	for {
		resp, err := s.youtube.PlaylistItems.List([]string{"snippet"}).
			PlaylistId(playlistID).MaxResults(50).PageToken(pageToken).Context(ctx).Do()
		if err != nil {
			return result, fmt.Errorf("fetch playlist %s: %w", playlistID, err)
		}
		result.Fetched += len(resp.Items)
		for _, item := range resp.Items {
			if item.Snippet != nil && item.Snippet.VideoOwnerChannelId != "" {
				channelIDs[item.Snippet.VideoOwnerChannelId] = struct{}{}
			}
		}
		if resp.NextPageToken == "" {
			break
		}
		pageToken = resp.NextPageToken
	}

	ids := make([]string, 0, len(channelIDs))
	for id := range channelIDs {
		ids = append(ids, id)
	}
	result.Brands = len(ids)
	for start := 0; start < len(ids); start += 50 {
		end := min(start+50, len(ids))
		resp, err := s.youtube.Channels.List([]string{"snippet", "contentDetails", "statistics"}).
			Id(ids[start:end]...).Context(ctx).Do()
		if err != nil {
			return result, err
		}
		for _, channel := range resp.Items {
			if channel.Snippet == nil || channel.ContentDetails == nil || channel.ContentDetails.RelatedPlaylists == nil {
				result.Failed++
				continue
			}
			brand, err := s.upsertChannelBrand(ctx, channel)
			if err != nil {
				result.Failed++
				log.Logger().Error(
					"Import playlist brand failed",
					zap.String("youtube_channel_id", channel.Id),
					zap.Error(err),
				)
				continue
			}
			result.Saved++
			result.Indexed++
			log.Logger().Info(
				"Imported playlist brand",
				zap.String("name", brand.Name),
				zap.String("youtube_channel_id", brand.YouTubeChannelID),
			)
		}
	}
	return result, nil
}

func (s *Service) upsertChannelBrand(ctx context.Context, channel *youtube.Channel) (*erogeModel.Brand, error) {
	raw, err := json.Marshal(channel)
	if err != nil {
		return nil, err
	}
	publicID, err := newBrandPublicID()
	if err != nil {
		return nil, err
	}
	now := time.Now()
	brand := &erogeModel.Brand{
		PublicID: publicID, Name: channel.Snippet.Title, YouTubeChannelID: channel.Id,
		AvatarURL: thumbnailURL(channel.Snippet.Thumbnails), YouTubeInfo: string(raw),
		UploadsPlaylistID:   channel.ContentDetails.RelatedPlaylists.Uploads,
		Status:              "approved",
		LastChannelSyncedAt: &now, UpdatedAt: now,
	}
	if err := s.repo.UpsertBrand(brand); err != nil {
		return nil, err
	}
	savedBrand, err := s.repo.BrandByYouTubeChannelID(channel.Id)
	if err != nil {
		return nil, err
	}
	if err := indexBrand(ctx, *savedBrand); err != nil {
		return nil, err
	}
	return savedBrand, nil
}

func (s *Service) createPendingBrand(ctx context.Context, userID uint64, channel *youtube.Channel) (*erogeModel.Brand, bool, error) {
	raw, err := json.Marshal(channel)
	if err != nil {
		return nil, false, err
	}
	publicID, err := newBrandPublicID()
	if err != nil {
		return nil, false, err
	}
	now := time.Now()
	brand := &erogeModel.Brand{
		PublicID: publicID, Name: channel.Snippet.Title, YouTubeChannelID: channel.Id,
		AvatarURL: thumbnailURL(channel.Snippet.Thumbnails), YouTubeInfo: string(raw),
		UploadsPlaylistID:   channel.ContentDetails.RelatedPlaylists.Uploads,
		Status:              "pending",
		SubmittedByUserID:   userID,
		LastChannelSyncedAt: &now,
		UpdatedAt:           now,
	}
	created, err := s.repo.CreatePendingBrand(brand)
	if err != nil {
		return nil, false, err
	}
	savedBrand, err := s.repo.BrandByYouTubeChannelID(channel.Id)
	if err != nil {
		return nil, false, err
	}
	return savedBrand, created, nil
}

func (s *Service) resolveChannel(ctx context.Context, channelRef string) (*youtube.Channel, error) {
	call := s.youtube.Channels.List([]string{"snippet", "contentDetails", "statistics"})
	if strings.HasPrefix(channelRef, "@") {
		call = call.ForHandle(strings.TrimPrefix(channelRef, "@"))
	} else {
		call = call.Id(channelRef)
	}
	resp, err := call.Context(ctx).Do()
	if err != nil {
		return nil, err
	}
	if len(resp.Items) != 1 {
		return nil, fmt.Errorf("youtube channel %s not found", channelRef)
	}
	channel := resp.Items[0]
	if channel.Snippet == nil || channel.ContentDetails == nil || channel.ContentDetails.RelatedPlaylists == nil {
		return nil, fmt.Errorf("youtube channel %s returned incomplete metadata", channelRef)
	}
	return channel, nil
}

func youtubeChannelRefFromURL(rawURL string) (string, error) {
	parsed, err := url.Parse(strings.TrimSpace(rawURL))
	if err != nil || parsed.Hostname() == "" {
		return "", fmt.Errorf("invalid YouTube URL")
	}
	host := strings.TrimPrefix(strings.ToLower(parsed.Hostname()), "www.")
	if host != "youtube.com" && host != "m.youtube.com" {
		return "", fmt.Errorf("URL must use youtube.com")
	}
	parts := strings.Split(strings.Trim(parsed.Path, "/"), "/")
	if len(parts) == 1 && strings.HasPrefix(parts[0], "@") {
		return parts[0], nil
	}
	if len(parts) == 2 && parts[0] == "channel" && strings.HasPrefix(parts[1], "UC") {
		return parts[1], nil
	}
	return "", fmt.Errorf("YouTube URL must use /@handle or /channel/UC... format")
}

func youtubeChannelRef(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "", fmt.Errorf("youtube channel is required")
	}
	if strings.Contains(value, "://") {
		return youtubeChannelRefFromURL(value)
	}
	if strings.HasPrefix(value, "@") || strings.HasPrefix(value, "UC") {
		return value, nil
	}
	return "", fmt.Errorf("YouTube channel must be an @handle, UC... channel ID, or YouTube URL")
}

func youtubePlaylistID(value string) (string, error) {
	value = strings.TrimSpace(value)
	if value == "" {
		return "", fmt.Errorf("playlist is required")
	}
	if !strings.Contains(value, "://") {
		return value, nil
	}
	parsed, err := url.Parse(value)
	if err != nil {
		return "", fmt.Errorf("invalid YouTube playlist URL")
	}
	host := strings.TrimPrefix(strings.ToLower(parsed.Hostname()), "www.")
	if host != "youtube.com" && host != "m.youtube.com" {
		return "", fmt.Errorf("playlist URL must use youtube.com")
	}
	playlistID := strings.TrimSpace(parsed.Query().Get("list"))
	if playlistID == "" {
		return "", fmt.Errorf("playlist URL is missing list parameter")
	}
	return playlistID, nil
}

func (s *Service) SyncBrands(ctx context.Context) (*SyncResult, error) {
	brands, err := s.repo.Brands()
	if err != nil {
		return nil, err
	}
	result := &SyncResult{Brands: len(brands)}
	for _, brand := range brands {
		if _, err := s.refreshBrand(ctx, brand); err != nil {
			result.Failed++
			log.Logger().Error(
				"Sync eroge brand failed",
				zap.String("brand", brand.Name),
				zap.String("youtube_channel_id", brand.YouTubeChannelID),
				zap.Error(err),
			)
			continue
		}
		result.Indexed++
	}
	return result, nil
}

func (s *Service) SyncVideos(ctx context.Context) (*SyncResult, error) {
	brands, err := s.repo.Brands()
	if err != nil {
		return nil, err
	}
	result := &SyncResult{Brands: len(brands)}
	for _, brand := range brands {
		if brand.UploadsPlaylistID == "" {
			refreshed, refreshErr := s.refreshBrand(ctx, brand)
			if refreshErr != nil {
				result.Failed++
				logBrandVideoSyncError(brand, refreshErr)
				continue
			}
			brand = *refreshed
		}
		syncStartedAt := time.Now()
		err := s.syncBrandVideos(ctx, brand, result)
		if isPlaylistNotFound(err) {
			refreshed, refreshErr := s.refreshBrand(ctx, brand)
			if refreshErr == nil {
				brand = *refreshed
				err = s.syncBrandVideos(ctx, brand, result)
			} else {
				err = fmt.Errorf("%w; refresh channel failed: %v", err, refreshErr)
			}
		}
		if err != nil {
			result.Failed++
			logBrandVideoSyncError(brand, err)
			continue
		}
		if err := s.repo.MarkVideoSync(brand.ID, syncStartedAt); err != nil {
			return result, err
		}
	}
	return result, nil
}

func (s *Service) ResyncBrandVideos(ctx context.Context, brandIDs []uint64) (*SyncResult, error) {
	result := &SyncResult{Brands: len(brandIDs)}
	for _, brandID := range brandIDs {
		brand, err := s.repo.BrandByID(brandID)
		if err != nil {
			result.Failed++
			log.Logger().Error("Load eroge brand for video resync failed", zap.Uint64("brand_id", brandID), zap.Error(err))
			continue
		}
		if brand.UploadsPlaylistID == "" {
			refreshed, refreshErr := s.refreshBrand(ctx, *brand)
			if refreshErr != nil {
				result.Failed++
				logBrandVideoSyncError(*brand, refreshErr)
				continue
			}
			brand = refreshed
		}
		syncStartedAt := time.Now()
		brand.LastVideoSyncedAt = nil
		err = s.syncBrandVideos(ctx, *brand, result)
		if isPlaylistNotFound(err) {
			refreshed, refreshErr := s.refreshBrand(ctx, *brand)
			if refreshErr == nil {
				brand = refreshed
				brand.LastVideoSyncedAt = nil
				err = s.syncBrandVideos(ctx, *brand, result)
			} else {
				err = fmt.Errorf("%w; refresh channel failed: %v", err, refreshErr)
			}
		}
		if err != nil {
			result.Failed++
			logBrandVideoSyncError(*brand, err)
			continue
		}
		if err := s.repo.MarkVideoSync(brand.ID, syncStartedAt); err != nil {
			return result, err
		}
	}
	return result, nil
}

func BackfillVideoDuration(ctx context.Context) (*SyncResult, error) {
	repo := erogeRepo.NewYouTubeRepository()
	videos, err := repo.VideosForDurationBackfill()
	if err != nil {
		return nil, err
	}
	result := &SyncResult{Fetched: len(videos)}
	for _, video := range videos {
		durationSeconds := youtubeInfoDurationSeconds(video.YouTubeInfo)
		if durationSeconds == 0 {
			result.Failed++
			log.Logger().Warn(
				"Backfill eroge video duration skipped",
				zap.Uint64("video_id", video.ID),
				zap.String("youtube_video_id", video.YouTubeVideoID),
			)
			continue
		}
		if video.DurationSeconds != durationSeconds {
			if err := repo.UpdateVideoDuration(video.ID, durationSeconds); err != nil {
				result.Failed++
				log.Logger().Error(
					"Backfill eroge video duration update failed",
					zap.Uint64("video_id", video.ID),
					zap.String("youtube_video_id", video.YouTubeVideoID),
					zap.Error(err),
				)
				continue
			}
			video.DurationSeconds = durationSeconds
			result.Saved++
		}
		brand := erogeModel.Brand{
			ID:               video.BrandID,
			Name:             video.BrandName,
			PublicID:         video.BrandPublicID,
			AvatarURL:        video.BrandAvatarURL,
			YouTubeChannelID: video.YouTubeChannelID,
		}
		if err := indexVideo(ctx, brand, video.Video, videoTags(video.Tags)); err != nil {
			result.Failed++
			log.Logger().Error(
				"Backfill eroge video duration index failed",
				zap.Uint64("video_id", video.ID),
				zap.String("youtube_video_id", video.YouTubeVideoID),
				zap.Error(err),
			)
			continue
		}
		result.Indexed++
	}
	return result, nil
}

func (s *Service) refreshBrand(ctx context.Context, brand erogeModel.Brand) (*erogeModel.Brand, error) {
	resp, err := s.youtube.Channels.List([]string{"snippet", "contentDetails", "statistics"}).
		Id(brand.YouTubeChannelID).Context(ctx).Do()
	if err != nil {
		return nil, fmt.Errorf("fetch channel %s: %w", brand.YouTubeChannelID, err)
	}
	if len(resp.Items) != 1 {
		return nil, fmt.Errorf("youtube channel %s not found", brand.YouTubeChannelID)
	}
	channel := resp.Items[0]
	if channel.Snippet == nil || channel.ContentDetails == nil || channel.ContentDetails.RelatedPlaylists == nil {
		return nil, fmt.Errorf("youtube channel %s returned incomplete metadata", brand.YouTubeChannelID)
	}
	raw, err := json.Marshal(channel)
	if err != nil {
		return nil, err
	}
	brand.AvatarURL = thumbnailURL(channel.Snippet.Thumbnails)
	brand.UploadsPlaylistID = channel.ContentDetails.RelatedPlaylists.Uploads
	brand.YouTubeInfo = string(raw)
	if err := s.repo.UpdateBrandChannel(
		brand.ID,
		brand.AvatarURL,
		brand.UploadsPlaylistID,
		brand.YouTubeInfo,
		time.Now(),
	); err != nil {
		return nil, err
	}
	if err := indexBrand(ctx, brand); err != nil {
		return nil, err
	}
	return &brand, nil
}

func isPlaylistNotFound(err error) bool {
	if err == nil {
		return false
	}
	var apiErr *googleapi.Error
	if !errors.As(err, &apiErr) || apiErr.Code != http.StatusNotFound {
		return false
	}
	for _, item := range apiErr.Errors {
		if item.Reason == "playlistNotFound" {
			return true
		}
	}
	return false
}

func logBrandVideoSyncError(brand erogeModel.Brand, err error) {
	log.Logger().Error(
		"Sync eroge brand videos failed",
		zap.String("brand", brand.Name),
		zap.String("youtube_channel_id", brand.YouTubeChannelID),
		zap.String("uploads_playlist_id", brand.UploadsPlaylistID),
		zap.Error(err),
	)
}

func (s *Service) syncBrandVideos(ctx context.Context, brand erogeModel.Brand, result *SyncResult) error {
	pageToken := ""
	for {
		resp, err := s.youtube.PlaylistItems.List([]string{"snippet", "contentDetails"}).
			PlaylistId(brand.UploadsPlaylistID).MaxResults(50).PageToken(pageToken).Context(ctx).Do()
		if err != nil {
			return err
		}
		ids := make([]string, 0, len(resp.Items))
		reachedCursor := false
		for _, item := range resp.Items {
			if brand.LastVideoSyncedAt != nil && item.Snippet != nil {
				publishedAt, parseErr := time.Parse(time.RFC3339, item.Snippet.PublishedAt)
				if parseErr == nil && !publishedAt.After(*brand.LastVideoSyncedAt) {
					reachedCursor = true
					break
				}
			}
			if item.ContentDetails != nil && item.ContentDetails.VideoId != "" {
				id := item.ContentDetails.VideoId
				ids = append(ids, id)
			}
		}
		result.Fetched += len(ids)
		if err := s.fetchAndSaveVideos(ctx, brand, ids, result); err != nil {
			return err
		}
		if reachedCursor || resp.NextPageToken == "" {
			return nil
		}
		pageToken = resp.NextPageToken
	}
}

func (s *Service) fetchAndSaveVideos(ctx context.Context, brand erogeModel.Brand, ids []string, result *SyncResult) error {
	if len(ids) == 0 {
		return nil
	}
	resp, err := s.youtube.Videos.List([]string{"snippet", "contentDetails", "statistics", "status"}).
		Id(ids...).Context(ctx).Do()
	if err != nil {
		return err
	}
	for _, item := range resp.Items {
		if item.Snippet == nil {
			continue
		}
		if !s.matches(item.Snippet.Title) {
			continue
		}
		result.Matched++
		publishedAt, err := time.Parse(time.RFC3339, item.Snippet.PublishedAt)
		if err != nil {
			return err
		}
		tags, _ := json.Marshal(item.Snippet.Tags)
		raw, err := json.Marshal(item)
		if err != nil {
			return err
		}
		video := erogeModel.Video{
			BrandID: brand.ID, YouTubeVideoID: item.Id, Title: item.Snippet.Title,
			Tags: string(tags), ThumbnailURL: thumbnailURL(item.Snippet.Thumbnails),
			Description: item.Snippet.Description, PublishedAt: publishedAt,
			DurationSeconds: youtubeDurationSeconds(item.ContentDetails),
			YouTubeInfo:     string(raw), UpdatedAt: time.Now(),
		}
		if err := s.repo.UpsertVideo(&video); err != nil {
			return err
		}
		result.Saved++
		if err := indexVideo(ctx, brand, video, item.Snippet.Tags); err != nil {
			return err
		}
		result.Indexed++
	}
	return nil
}

func youtubeDurationSeconds(details *youtube.VideoContentDetails) uint64 {
	if details == nil || details.Duration == "" {
		return 0
	}
	return parseYouTubeDurationSeconds(details.Duration)
}

func youtubeInfoDurationSeconds(raw string) uint64 {
	var video struct {
		ContentDetails struct {
			Duration string `json:"duration"`
		} `json:"contentDetails"`
	}
	if err := json.Unmarshal([]byte(raw), &video); err != nil {
		return 0
	}
	return parseYouTubeDurationSeconds(video.ContentDetails.Duration)
}

func parseYouTubeDurationSeconds(duration string) uint64 {
	if duration == "" {
		return 0
	}
	matches := youtubeDurationPattern.FindStringSubmatch(duration)
	if matches == nil {
		return 0
	}
	var total uint64
	multipliers := []uint64{3600, 60, 1}
	for index, value := range matches[1:] {
		if value == "" {
			continue
		}
		parsed, err := strconv.ParseUint(value, 10, 64)
		if err != nil {
			return 0
		}
		total += parsed * multipliers[index]
	}
	return total
}

func videoTags(raw string) []string {
	var tags []string
	_ = json.Unmarshal([]byte(raw), &tags)
	return tags
}

func (s *Service) matches(title string) bool {
	title = strings.ToLower(title)
	for _, keyword := range s.keywords {
		if strings.Contains(title, keyword) {
			return true
		}
	}
	return false
}

func thumbnailURL(thumbnails *youtube.ThumbnailDetails) string {
	if thumbnails == nil {
		return ""
	}
	for _, thumbnail := range []*youtube.Thumbnail{thumbnails.Maxres, thumbnails.Standard, thumbnails.High, thumbnails.Medium, thumbnails.Default} {
		if thumbnail != nil && thumbnail.Url != "" {
			return thumbnail.Url
		}
	}
	return ""
}

func indexVideo(ctx context.Context, brand erogeModel.Brand, video erogeModel.Video, tags []string) error {
	es := client.GetElasticSearch(enum.ESDefault)
	if es == nil {
		return fmt.Errorf("elasticsearch client is not initialized")
	}
	body, err := json.Marshal(map[string]any{
		"brand_id": brand.ID, "brand_name": brand.Name,
		"youtube_channel_id": brand.YouTubeChannelID, "youtube_video_id": video.YouTubeVideoID,
		"title": video.Title, "tags": tags, "thumbnail_url": video.ThumbnailURL,
		"description": video.Description, "published_at": video.PublishedAt,
		"duration_seconds": video.DurationSeconds,
	})
	if err != nil {
		return err
	}
	resp, err := es.Index(videoIndexName, bytes.NewReader(body), es.Index.WithContext(ctx),
		es.Index.WithDocumentID(video.YouTubeVideoID))
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= http.StatusOK && resp.StatusCode < http.StatusMultipleChoices {
		return nil
	}
	responseBody, _ := io.ReadAll(resp.Body)
	return fmt.Errorf("index video failed: status=%s body=%s", resp.Status(), responseBody)
}

func indexBrand(ctx context.Context, brand erogeModel.Brand) error {
	document := buildBrandOutput(brand)
	return indexDocument(ctx, brandIndexName, brand.PublicID, document)
}

func indexDocument(ctx context.Context, indexName, documentID string, document any) error {
	es := client.GetElasticSearch(enum.ESDefault)
	if es == nil {
		return fmt.Errorf("elasticsearch client is not initialized")
	}
	body, err := json.Marshal(document)
	if err != nil {
		return err
	}
	resp, err := es.Index(
		indexName,
		bytes.NewReader(body),
		es.Index.WithContext(ctx),
		es.Index.WithDocumentID(documentID),
	)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode >= http.StatusOK && resp.StatusCode < http.StatusMultipleChoices {
		return nil
	}
	responseBody, _ := io.ReadAll(resp.Body)
	return fmt.Errorf(
		"index document failed: index=%s id=%s status=%s body=%s",
		indexName,
		documentID,
		resp.Status(),
		responseBody,
	)
}

func deleteIndexDocuments(ctx context.Context, indexName string, documentIDs []string) error {
	es := client.GetElasticSearch(enum.ESDefault)
	if es == nil {
		return fmt.Errorf("elasticsearch client is not initialized")
	}
	for _, documentID := range documentIDs {
		resp, err := es.Delete(indexName, documentID, es.Delete.WithContext(ctx), es.Delete.WithRefresh("true"))
		if err != nil {
			return err
		}
		responseBody, readErr := io.ReadAll(resp.Body)
		resp.Body.Close()
		if readErr != nil {
			return readErr
		}
		if (resp.StatusCode < http.StatusOK || resp.StatusCode >= http.StatusMultipleChoices) &&
			resp.StatusCode != http.StatusNotFound {
			return fmt.Errorf(
				"delete index document failed: index=%s id=%s status=%s body=%s",
				indexName,
				documentID,
				resp.Status(),
				responseBody,
			)
		}
	}
	return nil
}

func RunBrandSync() {
	runSync("brand", func(s *Service, ctx context.Context) (*SyncResult, error) { return s.SyncBrands(ctx) })
}
func RunVideoSync() {
	runSync("video", func(s *Service, ctx context.Context) (*SyncResult, error) { return s.SyncVideos(ctx) })
}

func RunAddBrand(name, channelRef string) {
	ctx, cancel := context.WithTimeout(context.Background(), time.Minute)
	defer cancel()
	service, err := NewService(ctx)
	if err == nil {
		var brand *erogeModel.Brand
		brand, err = service.AddBrand(ctx, BrandInput{Name: name, ChannelRef: channelRef})
		if err == nil {
			log.Logger().Info(
				"Eroge brand saved",
				zap.String("name", brand.Name),
				zap.String("youtube_channel_id", brand.YouTubeChannelID),
			)
			return
		}
	}
	log.Logger().Error("Add eroge brand failed", zap.Error(err))
}

func RunImportBrands(path string) {
	path = strings.TrimSpace(path)
	if path == "" {
		log.Logger().Error("Import eroge brands failed", zap.Error(fmt.Errorf("csvFile is required")))
		return
	}
	file, err := os.Open(path)
	if err != nil {
		log.Logger().Error("Import eroge brands failed", zap.Error(err))
		return
	}
	defer file.Close()

	reader := csv.NewReader(file)
	reader.Comma = '|'
	reader.TrimLeadingSpace = true
	reader.FieldsPerRecord = 2

	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()
	service, err := NewService(ctx)
	if err != nil {
		log.Logger().Error("Import eroge brands failed", zap.Error(err))
		return
	}

	imported := 0
	for line := 1; ; line++ {
		record, readErr := reader.Read()
		if readErr == io.EOF {
			break
		}
		if readErr != nil {
			log.Logger().Error(
				"Import eroge brands failed",
				zap.Int("line", line),
				zap.Error(readErr),
			)
			return
		}
		brand, addErr := service.AddBrand(ctx, BrandInput{
			Name:       record[0],
			ChannelRef: record[1],
		})
		if addErr != nil {
			log.Logger().Error(
				"Import eroge brand failed",
				zap.Int("line", line),
				zap.String("name", record[0]),
				zap.String("youtube_channel", record[1]),
				zap.Error(addErr),
			)
			continue
		}
		imported++
		log.Logger().Info(
			"Imported eroge brand",
			zap.Int("line", line),
			zap.String("name", brand.Name),
			zap.String("youtube_channel_id", brand.YouTubeChannelID),
		)
	}
	log.Logger().Info("Import eroge brands finished", zap.Int("imported", imported))
}

func RunUpdateBrand(brandIDValue, youtubeURL string) {
	brandID, err := parseBrandID(brandIDValue)
	if err != nil {
		log.Logger().Error("Update eroge brand failed", zap.Error(err))
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()
	service, err := NewService(ctx)
	if err == nil {
		var brand *erogeModel.Brand
		brand, err = service.UpdateBrand(ctx, brandID, youtubeURL)
		if err == nil {
			log.Logger().Info(
				"Updated eroge brand",
				zap.Uint64("brand_id", brand.ID),
				zap.String("name", brand.Name),
				zap.String("youtube_channel_id", brand.YouTubeChannelID),
			)
			return
		}
	}
	log.Logger().Error("Update eroge brand failed", zap.Uint64("brand_id", brandID), zap.Error(err))
}

func RunDeleteBrand(brandIDValue string) {
	brandID, err := parseBrandID(brandIDValue)
	if err != nil {
		log.Logger().Error("Delete eroge brand failed", zap.Error(err))
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Minute)
	defer cancel()
	service, err := NewService(ctx)
	if err == nil {
		err = service.DeleteBrand(ctx, brandID)
		if err == nil {
			log.Logger().Info("Deleted eroge brand", zap.Uint64("brand_id", brandID))
			return
		}
	}
	log.Logger().Error("Delete eroge brand failed", zap.Uint64("brand_id", brandID), zap.Error(err))
}

func RunImportPlaylistBrands(playlistValue string) {
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Hour)
	defer cancel()
	service, err := NewService(ctx)
	if err == nil {
		var result *SyncResult
		result, err = service.ImportPlaylistBrands(ctx, playlistValue)
		if err == nil {
			log.Logger().Info("Import playlist brands finished", zap.Any("result", result))
			return
		}
	}
	log.Logger().Error("Import playlist brands failed", zap.Error(err))
}

func RunResyncBrandVideos(brandIDsValue string) {
	brandIDs, err := parseBrandIDs(brandIDsValue)
	if err != nil {
		log.Logger().Error("Resync eroge brand videos failed", zap.Error(err))
		return
	}
	ctx, cancel := context.WithTimeout(context.Background(), 6*time.Hour)
	defer cancel()
	service, err := NewService(ctx)
	if err == nil {
		var result *SyncResult
		result, err = service.ResyncBrandVideos(ctx, brandIDs)
		if err == nil {
			log.Logger().Info("Resync eroge brand videos finished", zap.Any("result", result))
			return
		}
	}
	log.Logger().Error("Resync eroge brand videos failed", zap.Error(err))
}

func RunBackfillVideoDuration() {
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Minute)
	defer cancel()
	result, err := BackfillVideoDuration(ctx)
	if err == nil {
		log.Logger().Info("Backfill eroge video duration finished", zap.Any("result", result))
		return
	}
	log.Logger().Error("Backfill eroge video duration failed", zap.Error(err))
}

func parseBrandID(value string) (uint64, error) {
	brandID, err := strconv.ParseUint(strings.TrimSpace(value), 10, 64)
	if err != nil || brandID == 0 {
		return 0, fmt.Errorf("brandId must be a positive integer")
	}
	return brandID, nil
}

func parseBrandIDs(value string) ([]uint64, error) {
	seen := make(map[uint64]struct{})
	brandIDs := make([]uint64, 0)
	for _, part := range strings.Split(value, ",") {
		if strings.TrimSpace(part) == "" {
			continue
		}
		brandID, err := parseBrandID(part)
		if err != nil {
			return nil, err
		}
		if _, exists := seen[brandID]; exists {
			continue
		}
		seen[brandID] = struct{}{}
		brandIDs = append(brandIDs, brandID)
	}
	if len(brandIDs) == 0 {
		return nil, fmt.Errorf("brandIds must contain at least one brand ID")
	}
	return brandIDs, nil
}

func runSync(name string, syncFunc func(*Service, context.Context) (*SyncResult, error)) {
	ctx, cancel := context.WithTimeout(context.Background(), 6*time.Hour)
	defer cancel()
	service, err := NewService(ctx)
	if err == nil {
		var result *SyncResult
		result, err = syncFunc(service, ctx)
		if err == nil {
			log.Logger().Info("Eroge YouTube sync finished", zap.String("type", name), zap.Any("result", result))
			return
		}
	}
	log.Logger().Error("Eroge YouTube sync failed", zap.String("type", name), zap.Error(err))
}
