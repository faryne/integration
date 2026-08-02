package storyteller

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"path/filepath"
	"strings"
	"time"

	"faryne.dev/config"
	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/service/log"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"go.uber.org/zap"
	"gorm.io/gorm"
)

type ImageStoryAssetBackfillResult struct {
	StoriesScanned int
	StoriesUpdated int
	StoriesFailed  int
	PagesUpdated   int
	AssetsCreated  int
	AssetsReused   int
}

func RunBackfillImageStoryAssets() {
	result, err := NewService().BackfillImageStoryAssets()
	if result != nil {
		log.Logger().Info("Storyteller image story asset backfill finished",
			zap.Int("stories_scanned", result.StoriesScanned),
			zap.Int("stories_updated", result.StoriesUpdated),
			zap.Int("stories_failed", result.StoriesFailed),
			zap.Int("pages_updated", result.PagesUpdated),
			zap.Int("assets_created", result.AssetsCreated),
			zap.Int("assets_reused", result.AssetsReused),
		)
	}
	if err != nil {
		log.Logger().Error("Storyteller image story asset backfill failed", zap.Error(err))
	}
}

func (s *Service) BackfillImageStoryAssets() (*ImageStoryAssetBackfillResult, error) {
	stories, err := s.repo.ImageStoriesForAssetBackfill()
	if err != nil {
		return nil, err
	}
	ctx := context.Background()
	client, err := initS3Client(ctx)
	if err != nil {
		return nil, err
	}
	result := &ImageStoryAssetBackfillResult{}
	projects := map[uint64]storytellerModel.Project{}
	var firstErr error
	for _, story := range stories {
		result.StoriesScanned++
		project, ok := projects[story.ProjectID]
		if !ok {
			row, err := s.repo.ProjectByID(story.ProjectID)
			if err != nil {
				result.StoriesFailed++
				firstErr = firstBackfillError(firstErr, fmt.Errorf("load project %d: %w", story.ProjectID, err))
				continue
			}
			project = *row
			projects[story.ProjectID] = project
		}
		stats, err := s.backfillImageStoryAssets(ctx, client, project, story)
		if err != nil {
			result.StoriesFailed++
			firstErr = firstBackfillError(firstErr, fmt.Errorf("story %s: %w", story.PublicID, err))
			log.Logger().Error("Backfill image story assets failed",
				zap.String("story_public_id", story.PublicID),
				zap.Uint64("story_id", story.ID),
				zap.Error(err),
			)
			continue
		}
		if stats.updated {
			result.StoriesUpdated++
		}
		result.PagesUpdated += stats.pagesUpdated
		result.AssetsCreated += stats.assetsCreated
		result.AssetsReused += stats.assetsReused
	}
	if firstErr != nil {
		return result, fmt.Errorf("backfill completed with %d failed stories, first error: %w", result.StoriesFailed, firstErr)
	}
	return result, nil
}

type imageStoryAssetBackfillStats struct {
	updated       bool
	pagesUpdated  int
	assetsCreated int
	assetsReused  int
}

func (s *Service) backfillImageStoryAssets(ctx context.Context, client *s3.Client, project storytellerModel.Project, story storytellerModel.Story) (imageStoryAssetBackfillStats, error) {
	var stats imageStoryAssetBackfillStats
	var content storytellerModel.StoryImageContent
	if strings.TrimSpace(story.LatestContent) != "" {
		if err := json.Unmarshal([]byte(story.LatestContent), &content); err != nil {
			return stats, fmt.Errorf("parse image story content: %w", err)
		}
	}
	assetsByPublicID := map[string]storytellerModel.Asset{}
	for i := range content.Pages {
		content.Pages[i].Key = strings.TrimSpace(content.Pages[i].Key)
		content.Pages[i].AssetPublicID = strings.TrimSpace(content.Pages[i].AssetPublicID)
		if content.Pages[i].AssetPublicID != "" {
			continue
		}
		if content.Pages[i].Key == "" {
			continue
		}
		asset, created, err := s.findOrCreateBackfillAsset(ctx, client, project, story, content.Pages[i], i)
		if err != nil {
			return stats, err
		}
		if created {
			stats.assetsCreated++
		} else {
			stats.assetsReused++
		}
		content.Pages[i].AssetPublicID = asset.PublicID
		assetsByPublicID[asset.PublicID] = asset
		stats.pagesUpdated++
		stats.updated = true
	}
	for _, page := range content.Pages {
		if page.AssetPublicID == "" || assetsByPublicID[page.AssetPublicID].ID != 0 {
			continue
		}
		asset, err := s.repo.Asset(project.ID, page.AssetPublicID)
		if err != nil {
			return stats, err
		}
		assetsByPublicID[page.AssetPublicID] = *asset
	}
	refs := imageStoryAssetReferences(story, content, assetsByPublicID)
	if !stats.updated {
		return stats, s.repo.ReplaceAssetReferences(assetReferenceTargetImageStory, story.ID, refs)
	}
	normalized, err := json.Marshal(content)
	if err != nil {
		return stats, err
	}
	story.LatestContent = string(normalized)
	return stats, s.repo.SaveImageStoryAssetBackfill(&story, refs)
}

func (s *Service) findOrCreateBackfillAsset(ctx context.Context, client *s3.Client, project storytellerModel.Project, story storytellerModel.Story, page storytellerModel.StoryImagePage, index int) (storytellerModel.Asset, bool, error) {
	if existing, err := s.repo.AssetByS3Key(project.ID, page.Key); err == nil && existing.ID != 0 {
		return *existing, false, nil
	} else if err != nil && !errors.Is(err, gorm.ErrRecordNotFound) {
		return storytellerModel.Asset{}, false, err
	}
	headCtx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()
	head, err := client.HeadObject(headCtx, &s3.HeadObjectInput{
		Bucket: aws.String(config.EnvConfig().S3Bucket),
		Key:    aws.String(page.Key),
	})
	if err != nil {
		return storytellerModel.Asset{}, false, fmt.Errorf("讀取圖片資訊失敗: %w", err)
	}
	contentType := normalizeBackfillContentType(aws.ToString(head.ContentType))
	fileExt, ok := allowedAssetImageContentTypes[contentType]
	if !ok {
		return storytellerModel.Asset{}, false, fmt.Errorf("不支援的檔案類型: %s", contentType)
	}
	fileSize := uint64(0)
	if head.ContentLength != nil {
		if *head.ContentLength > maxAssetImageSizeBytes {
			return storytellerModel.Asset{}, false, fmt.Errorf("圖片檔案大小超過上限（%d MB）", maxAssetImageSizeBytes/1024/1024)
		}
		fileSize = uint64(*head.ContentLength)
	}
	metadata := storytellerModel.AssetMetadata{}
	metadataCtx, metadataCancel := context.WithTimeout(ctx, 15*time.Second)
	defer metadataCancel()
	if err := fillImageSizeMetadata(metadataCtx, client, page.Key, metadata); err != nil {
		return storytellerModel.Asset{}, false, err
	}
	title := backfillAssetTitle(story.Title, page.Sort, index)
	asset := &storytellerModel.Asset{
		PublicID:         randomID(),
		UserID:           project.UserID,
		ProjectID:        project.ID,
		AssetType:        storytellerModel.AssetTypeImage,
		MimeType:         contentType,
		FileExt:          assetFileExt(fileExt, page.Key),
		FileSize:         fileSize,
		Metadata:         metadata,
		S3Key:            page.Key,
		OriginalFilename: filepath.Base(page.Key),
		Title:            title,
		AltText:          title,
	}
	if err := s.repo.CreateAsset(asset); err != nil {
		return storytellerModel.Asset{}, false, err
	}
	return *asset, true, nil
}

func imageStoryAssetReferences(story storytellerModel.Story, content storytellerModel.StoryImageContent, assets map[string]storytellerModel.Asset) []storytellerModel.AssetReference {
	rows := make([]storytellerModel.AssetReference, 0, len(content.Pages))
	for _, page := range content.Pages {
		asset := assets[strings.TrimSpace(page.AssetPublicID)]
		if asset.ID == 0 {
			continue
		}
		rows = append(rows, storytellerModel.AssetReference{
			AssetID:         asset.ID,
			TargetType:      assetReferenceTargetImageStory,
			TargetID:        story.ID,
			TargetVersionID: story.LatestVersionID,
			ReferenceKey:    strings.TrimSpace(page.ID),
		})
	}
	return rows
}

func backfillAssetTitle(storyTitle string, pageSort, index int) string {
	pageNumber := pageSort + 1
	if pageNumber < 1 {
		pageNumber = index + 1
	}
	return fmt.Sprintf("%s 第 %d 頁", strings.TrimSpace(storyTitle), pageNumber)
}

func normalizeBackfillContentType(contentType string) string {
	return strings.TrimSpace(strings.Split(contentType, ";")[0])
}

func firstBackfillError(current, next error) error {
	if current != nil {
		return current
	}
	return next
}
