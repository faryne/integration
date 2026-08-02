package storyteller

import (
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

const (
	assetReferenceTargetStory      = "story"
	assetReferenceTargetLore       = "lore"
	assetReferenceTargetImageStory = "image_story"
)

var assetURIRegexp = regexp.MustCompile(`steamloom-asset://([A-Za-z0-9._~-]+)`)

func assetPublicIDsFromMarkdown(content string) []string {
	matches := assetURIRegexp.FindAllStringSubmatch(content, -1)
	ids := make([]string, 0, len(matches))
	seen := map[string]bool{}
	for _, match := range matches {
		if len(match) < 2 {
			continue
		}
		id := strings.TrimSpace(match[1])
		if id == "" || seen[id] {
			continue
		}
		seen[id] = true
		ids = append(ids, id)
	}
	return ids
}

func (s *Service) assetsByPublicID(projectID uint64, publicIDs []string) (map[string]storytellerModel.Asset, error) {
	rows, err := s.repo.AssetsByPublicIDs(projectID, publicIDs)
	if err != nil {
		return nil, err
	}
	output := make(map[string]storytellerModel.Asset, len(rows))
	for _, row := range rows {
		output[row.PublicID] = row
	}
	for _, publicID := range publicIDs {
		if _, ok := output[publicID]; !ok {
			return nil, fmt.Errorf("asset not found in this project: %s", publicID)
		}
	}
	return output, nil
}

func (s *Service) syncMarkdownAssetReferences(projectID uint64, targetType string, targetID uint64, targetVersionID *uint64, content string) error {
	publicIDs := assetPublicIDsFromMarkdown(content)
	assets, err := s.assetsByPublicID(projectID, publicIDs)
	if err != nil {
		return err
	}
	rows := make([]storytellerModel.AssetReference, 0, len(publicIDs))
	for _, publicID := range publicIDs {
		rows = append(rows, storytellerModel.AssetReference{
			AssetID:         assets[publicID].ID,
			TargetType:      targetType,
			TargetID:        targetID,
			TargetVersionID: targetVersionID,
			ReferenceKey:    publicID,
		})
	}
	return s.repo.ReplaceAssetReferences(targetType, targetID, rows)
}

func (s *Service) validateMarkdownAssetReferences(projectID uint64, content string) error {
	publicIDs := assetPublicIDsFromMarkdown(content)
	_, err := s.assetsByPublicID(projectID, publicIDs)
	return err
}

func (s *Service) signAssetURIsInContent(projectID uint64, content string) (string, error) {
	publicIDs := assetPublicIDsFromMarkdown(content)
	if len(publicIDs) == 0 {
		return content, nil
	}
	assets, err := s.assetsByPublicID(projectID, publicIDs)
	if err != nil {
		return "", err
	}
	replacements := make([]string, 0, len(publicIDs)*2)
	for _, publicID := range publicIDs {
		url, err := signImageURL(assets[publicID].S3Key)
		if err != nil {
			return "", err
		}
		replacements = append(replacements, "steamloom-asset://"+publicID, url)
	}
	return strings.NewReplacer(replacements...).Replace(content), nil
}

func (s *Service) normalizeImageStoryContent(projectID uint64, rawContent string) (string, error) {
	var content storytellerModel.StoryImageContent
	if strings.TrimSpace(rawContent) != "" {
		if err := json.Unmarshal([]byte(rawContent), &content); err != nil {
			return "", fmt.Errorf("parse image story content: %w", err)
		}
	}
	if len(content.Pages) > maxImagePagesPerUpload {
		return "", fmt.Errorf("最多一次只能有 %d 張圖", maxImagePagesPerUpload)
	}
	publicIDs := make([]string, 0, len(content.Pages))
	for _, page := range content.Pages {
		publicID := strings.TrimSpace(page.AssetPublicID)
		if publicID != "" {
			publicIDs = append(publicIDs, publicID)
		}
	}
	assets, err := s.assetsByPublicID(projectID, uniqueStrings(publicIDs))
	if err != nil {
		return "", err
	}
	keys := make([]string, 0, len(content.Pages))
	for i := range content.Pages {
		content.Pages[i].AssetPublicID = strings.TrimSpace(content.Pages[i].AssetPublicID)
		content.Pages[i].Key = strings.TrimSpace(content.Pages[i].Key)
		if content.Pages[i].AssetPublicID != "" {
			asset := assets[content.Pages[i].AssetPublicID]
			content.Pages[i].Key = asset.S3Key
			continue
		}
		if content.Pages[i].Key == "" {
			return "", errors.New("image story page must include key or asset_public_id")
		}
		keys = append(keys, content.Pages[i].Key)
	}
	if err := validateImagePageSizes(keys); err != nil {
		return "", err
	}
	normalized, err := json.Marshal(content)
	if err != nil {
		return "", err
	}
	return string(normalized), nil
}

func (s *Service) syncImageStoryAssetReferences(projectID uint64, story *storytellerModel.Story) error {
	var content storytellerModel.StoryImageContent
	if strings.TrimSpace(story.LatestContent) != "" {
		if err := json.Unmarshal([]byte(story.LatestContent), &content); err != nil {
			return fmt.Errorf("parse image story content: %w", err)
		}
	}
	publicIDs := make([]string, 0, len(content.Pages))
	for _, page := range content.Pages {
		if strings.TrimSpace(page.AssetPublicID) != "" {
			publicIDs = append(publicIDs, strings.TrimSpace(page.AssetPublicID))
		}
	}
	assets, err := s.assetsByPublicID(projectID, uniqueStrings(publicIDs))
	if err != nil {
		return err
	}
	rows := make([]storytellerModel.AssetReference, 0, len(content.Pages))
	for _, page := range content.Pages {
		publicID := strings.TrimSpace(page.AssetPublicID)
		if publicID == "" {
			continue
		}
		rows = append(rows, storytellerModel.AssetReference{
			AssetID:         assets[publicID].ID,
			TargetType:      assetReferenceTargetImageStory,
			TargetID:        story.ID,
			TargetVersionID: story.LatestVersionID,
			ReferenceKey:    strings.TrimSpace(page.ID),
		})
	}
	return s.repo.ReplaceAssetReferences(assetReferenceTargetImageStory, story.ID, rows)
}

func uniqueStrings(values []string) []string {
	output := make([]string, 0, len(values))
	seen := map[string]bool{}
	for _, value := range values {
		value = strings.TrimSpace(value)
		if value == "" || seen[value] {
			continue
		}
		seen[value] = true
		output = append(output, value)
	}
	return output
}
