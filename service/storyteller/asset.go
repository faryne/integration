package storyteller

import (
	"context"
	"errors"
	"fmt"
	"image"
	_ "image/gif"
	_ "image/jpeg"
	_ "image/png"
	"io"
	"path/filepath"
	"strings"
	"time"

	storytellerModel "faryne.dev/model/entity/storyteller"

	"faryne.dev/config"
	"faryne.dev/service/log"

	"github.com/aws/aws-sdk-go-v2/aws"
	"github.com/aws/aws-sdk-go-v2/service/s3"
	"go.uber.org/zap"
	_ "golang.org/x/image/webp"
)

const (
	assetKeyPrefix                = "steamloom/assets/"
	assetCollectionUncategorized  = "__uncategorized__"
	maxAssetImageSizeBytes        = maxImagePageSizeBytes
	maxAssetUploadFilesPerPresign = maxImagePagesPerUpload
	maxImageHeaderReadBytes       = 4 * 1024 * 1024
)

var allowedAssetImageContentTypes = map[string]string{
	"image/jpeg": "jpg",
	"image/png":  "png",
	"image/webp": "webp",
	"image/gif":  "gif",
}

func randomAssetKey() string {
	return assetKeyPrefix + time.Now().Format("2006/01/02") + "/" + randomID()
}

func normalizeAssetPage(page, pageSize int) (int, int) {
	if page < 1 {
		page = 1
	}
	if pageSize < 1 {
		pageSize = 24
	}
	if pageSize > 100 {
		pageSize = 100
	}
	return page, pageSize
}

func normalizeAssetMetadata(metadata storytellerModel.AssetMetadata) storytellerModel.AssetMetadata {
	if metadata == nil {
		return storytellerModel.AssetMetadata{}
	}
	return metadata
}

func (s *Service) Assets(userID uint64, projectPublicID, collectionPublicID, assetType, keyword string, page, pageSize int) (*storytellerModel.AssetPageOutput, error) {
	page, pageSize = normalizeAssetPage(page, pageSize)
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	collectionID, uncategorizedOnly, err := s.resolveAssetCollectionFilter(project.ID, collectionPublicID)
	if err != nil {
		return nil, err
	}
	collectionPublicIDs, err := s.assetCollectionPublicIDMap(project.ID)
	if err != nil {
		return nil, err
	}
	rows, total, err := s.repo.Assets(project.ID, collectionID, uncategorizedOnly, assetType, keyword, (page-1)*pageSize, pageSize)
	if err != nil {
		return nil, err
	}
	counts, err := s.assetReferenceCounts(rows)
	if err != nil {
		return nil, err
	}
	outputs := make([]storytellerModel.AssetOutput, 0, len(rows))
	for _, row := range rows {
		output, err := s.assetOutput(row, collectionPublicIDs, counts[row.ID])
		if err != nil {
			return nil, err
		}
		outputs = append(outputs, output)
	}
	return &storytellerModel.AssetPageOutput{
		Assets:     outputs,
		TotalCount: total,
		Page:       page,
		PageSize:   pageSize,
	}, nil
}

func (s *Service) Asset(userID uint64, projectPublicID, assetPublicID string) (*storytellerModel.AssetOutput, error) {
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	asset, err := s.repo.Asset(project.ID, strings.TrimSpace(assetPublicID))
	if err != nil {
		return nil, err
	}
	count, err := s.repo.AssetReferenceCount(asset.ID)
	if err != nil {
		return nil, err
	}
	collectionPublicIDs, err := s.assetCollectionPublicIDMap(project.ID)
	if err != nil {
		return nil, err
	}
	output, err := s.assetOutput(*asset, collectionPublicIDs, count)
	return &output, err
}

func (s *Service) PresignAssetUpload(ctx context.Context, userID uint64, projectPublicID string, input storytellerModel.AssetUploadRequest) ([]storytellerModel.AssetUploadOutput, error) {
	if len(input.Files) == 0 {
		return nil, errors.New("files must not be empty")
	}
	if len(input.Files) > maxAssetUploadFilesPerPresign {
		return nil, fmt.Errorf("最多一次只能上傳 %d 個資產", maxAssetUploadFilesPerPresign)
	}
	if _, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID); err != nil {
		return nil, err
	}
	client, err := initS3Client(ctx)
	if err != nil {
		return nil, err
	}
	presignClient := s3.NewPresignClient(client)
	outputs := make([]storytellerModel.AssetUploadOutput, 0, len(input.Files))
	for _, file := range input.Files {
		contentType := strings.TrimSpace(file.ContentType)
		if _, err := validateAssetFileType(storytellerModel.AssetTypeImage, contentType); err != nil {
			return nil, err
		}
		key := randomAssetKey()
		request, err := presignClient.PresignPutObject(ctx, &s3.PutObjectInput{
			Bucket:      aws.String(config.EnvConfig().S3Bucket),
			Key:         aws.String(key),
			ContentType: aws.String(contentType),
			Tagging:     aws.String(storytellerPendingObjectTagging),
		}, s3.WithPresignExpires(imageUploadPresignTTL))
		if err != nil {
			return nil, fmt.Errorf("presign asset upload url: %w", err)
		}
		outputs = append(outputs, storytellerModel.AssetUploadOutput{
			Key:              key,
			UploadURL:        request.URL,
			ContentType:      contentType,
			OriginalFilename: strings.TrimSpace(file.OriginalFilename),
		})
	}
	return outputs, nil
}

func (s *Service) PresignAssetReplace(ctx context.Context, userID uint64, projectPublicID, assetPublicID string, input storytellerModel.AssetReplacePresignRequest) (*storytellerModel.AssetReplacePresignOutput, error) {
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	asset, err := s.repo.Asset(project.ID, strings.TrimSpace(assetPublicID))
	if err != nil {
		return nil, err
	}
	contentType := strings.TrimSpace(input.MimeType)
	if _, err := validateAssetFileType(asset.AssetType, contentType); err != nil {
		return nil, err
	}
	if input.Size > maxAssetImageSizeBytes {
		return nil, fmt.Errorf("圖片檔案大小超過上限（%d MB）", maxAssetImageSizeBytes/1024/1024)
	}
	client, err := initS3Client(ctx)
	if err != nil {
		return nil, err
	}
	key := randomAssetKey()
	request, err := s3.NewPresignClient(client).PresignPutObject(ctx, &s3.PutObjectInput{
		Bucket:      aws.String(config.EnvConfig().S3Bucket),
		Key:         aws.String(key),
		ContentType: aws.String(contentType),
		Tagging:     aws.String(storytellerPendingObjectTagging),
	}, s3.WithPresignExpires(imageUploadPresignTTL))
	if err != nil {
		return nil, fmt.Errorf("presign asset replace url: %w", err)
	}
	return &storytellerModel.AssetReplacePresignOutput{
		PendingKey: key,
		UploadURL:  request.URL,
		MimeType:   contentType,
		Filename:   strings.TrimSpace(input.Filename),
	}, nil
}

func (s *Service) ConfirmAssetUpload(userID uint64, projectPublicID string, input storytellerModel.AssetConfirmRequest) (*storytellerModel.AssetOutput, error) {
	key := strings.TrimSpace(input.Key)
	contentType := strings.TrimSpace(input.ContentType)
	if key == "" || !strings.HasPrefix(key, assetKeyPrefix) {
		return nil, errors.New("invalid asset key")
	}
	fileExt, ok := allowedAssetImageContentTypes[contentType]
	if !ok {
		return nil, fmt.Errorf("不支援的檔案類型: %s", contentType)
	}
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	if existing, err := s.repo.AssetByS3Key(project.ID, key); err == nil && existing.ID != 0 {
		count, err := s.repo.AssetReferenceCount(existing.ID)
		if err != nil {
			return nil, err
		}
		collectionPublicIDs, err := s.assetCollectionPublicIDMap(project.ID)
		if err != nil {
			return nil, err
		}
		output, err := s.assetOutput(*existing, collectionPublicIDs, count)
		return &output, err
	}
	collectionID, err := s.resolveAssetCollectionID(project.ID, input.CollectionID)
	if err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	client, err := initS3Client(ctx)
	if err != nil {
		return nil, err
	}
	head, err := client.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(config.EnvConfig().S3Bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, fmt.Errorf("讀取資產資訊失敗: %w", err)
	}
	if head.ContentType != nil && *head.ContentType != "" && *head.ContentType != contentType {
		deleteStorytellerPendingObject(ctx, client, key,
			zap.String("reason", "asset_upload_content_type_mismatch"),
			zap.String("expected_content_type", contentType),
			zap.String("actual_content_type", *head.ContentType),
		)
		return nil, fmt.Errorf("上傳檔案類型不一致: %s", *head.ContentType)
	}
	fileSize := uint64(0)
	if head.ContentLength != nil {
		if *head.ContentLength > maxAssetImageSizeBytes {
			deleteStorytellerPendingObject(ctx, client, key,
				zap.String("reason", "asset_upload_size_exceeded"),
				zap.Int64("content_length_bytes", *head.ContentLength),
			)
			return nil, fmt.Errorf("圖片檔案大小超過上限（%d MB）", maxAssetImageSizeBytes/1024/1024)
		}
		fileSize = uint64(*head.ContentLength)
	}
	metadata := normalizeAssetMetadata(input.Metadata)
	if err := fillImageSizeMetadata(ctx, client, key, metadata); err != nil {
		deleteStorytellerPendingObject(ctx, client, key,
			zap.String("reason", "asset_upload_image_metadata_failed"),
		)
		return nil, err
	}
	asset := &storytellerModel.Asset{
		PublicID:         randomID(),
		UserID:           project.UserID,
		ProjectID:        project.ID,
		CollectionID:     collectionID,
		AssetType:        storytellerModel.AssetTypeImage,
		MimeType:         contentType,
		FileExt:          assetFileExt(fileExt, input.OriginalFilename),
		FileSize:         fileSize,
		Metadata:         metadata,
		S3Key:            key,
		OriginalFilename: strings.TrimSpace(input.OriginalFilename),
		Title:            strings.TrimSpace(input.Title),
		AltText:          strings.TrimSpace(input.AltText),
		Description:      strings.TrimSpace(input.Description),
	}
	if asset.Title == "" {
		asset.Title = asset.OriginalFilename
	}
	if err := s.repo.CreateAsset(asset); err != nil {
		return nil, err
	}
	clearStorytellerPendingObjectTag(ctx, client, key,
		zap.String("reason", "asset_upload_confirmed"),
		zap.Uint64("asset_id", asset.ID),
		zap.String("asset_public_id", asset.PublicID),
	)
	collectionPublicIDs, err := s.assetCollectionPublicIDMap(project.ID)
	if err != nil {
		return nil, err
	}
	output, err := s.assetOutput(*asset, collectionPublicIDs, 0)
	return &output, err
}

func (s *Service) ConfirmAssetReplace(userID uint64, projectPublicID, assetPublicID string, input storytellerModel.AssetReplaceConfirmRequest) (*storytellerModel.AssetOutput, error) {
	key := strings.TrimSpace(input.PendingKey)
	if key == "" || !strings.HasPrefix(key, assetKeyPrefix) {
		return nil, errors.New("invalid asset pending key")
	}
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	asset, err := s.repo.Asset(project.ID, strings.TrimSpace(assetPublicID))
	if err != nil {
		return nil, err
	}
	if existing, err := s.repo.AssetByS3Key(project.ID, key); err == nil && existing.ID != asset.ID {
		return nil, errors.New("asset pending key is already used")
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()
	client, err := initS3Client(ctx)
	if err != nil {
		return nil, err
	}
	head, err := client.HeadObject(ctx, &s3.HeadObjectInput{
		Bucket: aws.String(config.EnvConfig().S3Bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return nil, fmt.Errorf("讀取替換資產資訊失敗: %w", err)
	}
	contentType := ""
	if head.ContentType != nil {
		contentType = strings.TrimSpace(*head.ContentType)
	}
	fileExt, err := validateAssetFileType(asset.AssetType, contentType)
	if err != nil {
		deleteStorytellerPendingObject(ctx, client, key,
			zap.String("reason", "asset_replace_content_type_invalid"),
			zap.Uint64("asset_id", asset.ID),
			zap.String("asset_public_id", asset.PublicID),
			zap.String("content_type", contentType),
		)
		return nil, err
	}
	fileSize := uint64(0)
	if head.ContentLength != nil {
		if *head.ContentLength > maxAssetImageSizeBytes {
			deleteStorytellerPendingObject(ctx, client, key,
				zap.String("reason", "asset_replace_size_exceeded"),
				zap.Uint64("asset_id", asset.ID),
				zap.String("asset_public_id", asset.PublicID),
				zap.Int64("content_length_bytes", *head.ContentLength),
			)
			return nil, fmt.Errorf("圖片檔案大小超過上限（%d MB）", maxAssetImageSizeBytes/1024/1024)
		}
		fileSize = uint64(*head.ContentLength)
	}
	metadata := storytellerModel.AssetMetadata{}
	if err := fillImageSizeMetadata(ctx, client, key, metadata); err != nil {
		deleteStorytellerPendingObject(ctx, client, key,
			zap.String("reason", "asset_replace_image_metadata_failed"),
			zap.Uint64("asset_id", asset.ID),
			zap.String("asset_public_id", asset.PublicID),
		)
		return nil, err
	}
	oldKey := asset.S3Key
	asset.S3Key = key
	asset.MimeType = contentType
	asset.FileExt = fileExt
	asset.FileSize = fileSize
	asset.Metadata = metadata
	if err := s.repo.ReplaceAssetFile(asset); err != nil {
		return nil, err
	}
	clearStorytellerPendingObjectTag(ctx, client, key,
		zap.String("reason", "asset_replace_confirmed"),
		zap.Uint64("asset_id", asset.ID),
		zap.String("asset_public_id", asset.PublicID),
	)
	if oldKey != "" && oldKey != key {
		if _, err := client.DeleteObject(ctx, &s3.DeleteObjectInput{
			Bucket: aws.String(config.EnvConfig().S3Bucket),
			Key:    aws.String(oldKey),
		}); err != nil {
			log.Logger().Warn("Storyteller replace asset delete old object failed",
				zap.Uint64("asset_id", asset.ID),
				zap.String("asset_public_id", asset.PublicID),
				zap.String("old_s3_key", oldKey),
				zap.String("new_s3_key", key),
				zap.Error(err),
			)
		}
	}
	updatedAsset, err := s.repo.Asset(project.ID, asset.PublicID)
	if err != nil {
		return nil, err
	}
	count, err := s.repo.AssetReferenceCount(updatedAsset.ID)
	if err != nil {
		return nil, err
	}
	collectionPublicIDs, err := s.assetCollectionPublicIDMap(project.ID)
	if err != nil {
		return nil, err
	}
	output, err := s.assetOutput(*updatedAsset, collectionPublicIDs, count)
	return &output, err
}

func (s *Service) UpdateAsset(userID uint64, projectPublicID, assetPublicID string, input storytellerModel.AssetUpdateRequest) (*storytellerModel.AssetOutput, error) {
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	asset, err := s.repo.Asset(project.ID, strings.TrimSpace(assetPublicID))
	if err != nil {
		return nil, err
	}
	asset.Title = strings.TrimSpace(input.Title)
	asset.AltText = strings.TrimSpace(input.AltText)
	asset.Description = strings.TrimSpace(input.Description)
	asset.Metadata = normalizeAssetMetadata(input.Metadata)
	if err := s.repo.UpdateAsset(asset); err != nil {
		return nil, err
	}
	count, err := s.repo.AssetReferenceCount(asset.ID)
	if err != nil {
		return nil, err
	}
	collectionPublicIDs, err := s.assetCollectionPublicIDMap(project.ID)
	if err != nil {
		return nil, err
	}
	output, err := s.assetOutput(*asset, collectionPublicIDs, count)
	return &output, err
}

func (s *Service) MoveAsset(userID uint64, projectPublicID, assetPublicID string, input storytellerModel.AssetMoveRequest) (*storytellerModel.AssetOutput, error) {
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	asset, err := s.repo.Asset(project.ID, strings.TrimSpace(assetPublicID))
	if err != nil {
		return nil, err
	}
	collectionID, err := s.resolveAssetCollectionID(project.ID, input.CollectionID)
	if err != nil {
		return nil, err
	}
	asset.CollectionID = collectionID
	if err := s.repo.MoveAsset(asset); err != nil {
		return nil, err
	}
	count, err := s.repo.AssetReferenceCount(asset.ID)
	if err != nil {
		return nil, err
	}
	collectionPublicIDs, err := s.assetCollectionPublicIDMap(project.ID)
	if err != nil {
		return nil, err
	}
	output, err := s.assetOutput(*asset, collectionPublicIDs, count)
	return &output, err
}

func (s *Service) DeleteAsset(userID uint64, projectPublicID, assetPublicID string) error {
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return err
	}
	asset, err := s.repo.Asset(project.ID, strings.TrimSpace(assetPublicID))
	if err != nil {
		return err
	}
	count, err := s.repo.AssetReferenceCount(asset.ID)
	if err != nil {
		return err
	}
	if count > 0 {
		return errors.New("這個資產仍被作品引用，不能刪除")
	}
	return s.repo.DeleteAsset(asset)
}

func fillImageSizeMetadata(ctx context.Context, client *s3.Client, key string, metadata storytellerModel.AssetMetadata) error {
	object, err := client.GetObject(ctx, &s3.GetObjectInput{
		Bucket: aws.String(config.EnvConfig().S3Bucket),
		Key:    aws.String(key),
	})
	if err != nil {
		return fmt.Errorf("讀取圖片內容失敗: %w", err)
	}
	defer object.Body.Close()
	cfg, _, err := image.DecodeConfig(io.LimitReader(object.Body, maxImageHeaderReadBytes))
	if err != nil {
		return fmt.Errorf("解析圖片尺寸失敗: %w", err)
	}
	metadata["width"] = cfg.Width
	metadata["height"] = cfg.Height
	return nil
}

func validateAssetFileType(assetType storytellerModel.AssetType, contentType string) (string, error) {
	if assetType != storytellerModel.AssetTypeImage {
		return "", errors.New("目前只支援替換圖片資產")
	}
	fileExt, ok := allowedAssetImageContentTypes[contentType]
	if !ok {
		return "", fmt.Errorf("不支援的檔案類型: %s", contentType)
	}
	return fileExt, nil
}

func assetFileExt(defaultExt, filename string) string {
	ext := strings.TrimPrefix(strings.ToLower(filepath.Ext(strings.TrimSpace(filename))), ".")
	if ext != "" && len(ext) <= 16 {
		return ext
	}
	return defaultExt
}

func (s *Service) assetReferenceCounts(rows []storytellerModel.Asset) (map[uint64]int64, error) {
	ids := make([]uint64, 0, len(rows))
	for _, row := range rows {
		ids = append(ids, row.ID)
	}
	return s.repo.AssetReferenceCounts(ids)
}

func (s *Service) assetOutput(asset storytellerModel.Asset, collectionPublicIDs map[uint64]string, referenceCount int64) (storytellerModel.AssetOutput, error) {
	previewURL, err := signImageURL(asset.S3Key)
	if err != nil {
		return storytellerModel.AssetOutput{}, err
	}
	collectionPublicID := ""
	if asset.CollectionID != nil {
		collectionPublicID = collectionPublicIDs[*asset.CollectionID]
	}
	return storytellerModel.AssetOutput{
		ID:               asset.ID,
		PublicID:         asset.PublicID,
		ProjectID:        asset.ProjectID,
		CollectionID:     collectionPublicID,
		AssetType:        asset.AssetType,
		MimeType:         asset.MimeType,
		FileExt:          asset.FileExt,
		FileSize:         asset.FileSize,
		Metadata:         normalizeAssetMetadata(asset.Metadata),
		OriginalFilename: asset.OriginalFilename,
		Title:            asset.Title,
		AltText:          asset.AltText,
		Description:      asset.Description,
		PreviewURL:       previewURL,
		ReferenceCount:   referenceCount,
		CreatedAt:        asset.CreatedAt,
		UpdatedAt:        asset.UpdatedAt,
	}, nil
}

func (s *Service) resolveAssetCollectionID(projectID uint64, collectionPublicID string) (*uint64, error) {
	collectionPublicID = strings.TrimSpace(collectionPublicID)
	if collectionPublicID == "" {
		return nil, nil
	}
	collection, err := s.repo.AssetCollection(projectID, collectionPublicID)
	if err != nil {
		return nil, err
	}
	return &collection.ID, nil
}

func (s *Service) resolveAssetCollectionFilter(projectID uint64, collectionPublicID string) (*uint64, bool, error) {
	collectionPublicID = strings.TrimSpace(collectionPublicID)
	if collectionPublicID == assetCollectionUncategorized {
		return nil, true, nil
	}
	collectionID, err := s.resolveAssetCollectionID(projectID, collectionPublicID)
	return collectionID, false, err
}

func (s *Service) assetCollectionPublicIDMap(projectID uint64) (map[uint64]string, error) {
	collections, err := s.repo.AssetCollections(projectID)
	if err != nil {
		return nil, err
	}
	output := make(map[uint64]string, len(collections))
	for _, collection := range collections {
		output[collection.ID] = collection.PublicID
	}
	return output, nil
}

func (s *Service) AssetCollections(userID uint64, projectPublicID string) ([]storytellerModel.AssetCollectionOutput, error) {
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	rows, err := s.repo.AssetCollections(project.ID)
	if err != nil {
		return nil, err
	}
	ids := make([]uint64, 0, len(rows))
	for _, row := range rows {
		ids = append(ids, row.ID)
	}
	counts, err := s.repo.AssetCollectionAssetCounts(ids)
	if err != nil {
		return nil, err
	}
	outputs := make([]storytellerModel.AssetCollectionOutput, 0, len(rows))
	for _, row := range rows {
		outputs = append(outputs, assetCollectionOutput(row, counts[row.ID]))
	}
	return outputs, nil
}

func (s *Service) CreateAssetCollection(userID uint64, projectPublicID string, input storytellerModel.AssetCollectionRequest) (*storytellerModel.AssetCollectionOutput, error) {
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return nil, errors.New("collection name is required")
	}
	description := strings.TrimSpace(input.Description)
	row := &storytellerModel.AssetCollection{
		PublicID:    randomID(),
		ProjectID:   project.ID,
		Name:        name,
		Description: &description,
		Sort:        input.Sort,
	}
	if err := s.repo.CreateAssetCollection(row); err != nil {
		return nil, err
	}
	output := assetCollectionOutput(*row, 0)
	return &output, nil
}

func (s *Service) UpdateAssetCollection(userID uint64, projectPublicID, collectionPublicID string, input storytellerModel.AssetCollectionRequest) (*storytellerModel.AssetCollectionOutput, error) {
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}
	row, err := s.repo.AssetCollection(project.ID, strings.TrimSpace(collectionPublicID))
	if err != nil {
		return nil, err
	}
	name := strings.TrimSpace(input.Name)
	if name == "" {
		return nil, errors.New("collection name is required")
	}
	description := strings.TrimSpace(input.Description)
	row.Name = name
	row.Description = &description
	row.Sort = input.Sort
	if err := s.repo.UpdateAssetCollection(row); err != nil {
		return nil, err
	}
	count, err := s.repo.AssetCollectionAssetCount(row.ID)
	if err != nil {
		return nil, err
	}
	output := assetCollectionOutput(*row, count)
	return &output, nil
}

func (s *Service) DeleteAssetCollection(userID uint64, projectPublicID, collectionPublicID string) error {
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return err
	}
	row, err := s.repo.AssetCollection(project.ID, strings.TrimSpace(collectionPublicID))
	if err != nil {
		return err
	}
	count, err := s.repo.AssetCollectionAssetCount(row.ID)
	if err != nil {
		return err
	}
	if count > 0 {
		return errors.New("collection 內仍有資產，不能刪除")
	}
	return s.repo.DeleteAssetCollection(row)
}

func assetCollectionOutput(row storytellerModel.AssetCollection, assetCount int64) storytellerModel.AssetCollectionOutput {
	return storytellerModel.AssetCollectionOutput{
		ID:          row.ID,
		PublicID:    row.PublicID,
		ProjectID:   row.ProjectID,
		Name:        row.Name,
		Description: assetCollectionDescription(row.Description),
		Sort:        row.Sort,
		AssetCount:  assetCount,
		CreatedAt:   row.CreatedAt,
		UpdatedAt:   row.UpdatedAt,
	}
}

func assetCollectionDescription(description *string) string {
	if description == nil {
		return ""
	}
	return strings.TrimSpace(*description)
}
