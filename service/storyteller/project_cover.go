package storyteller

import (
	"errors"
	"strings"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/repository"
	"faryne.dev/service/log"

	"go.uber.org/zap"
)

// resolveProjectCover 只驗證並寫入 CoverAssetID，不碰引用；nil＝不變、空字串＝清除。
func (s *Service) resolveProjectCover(project *storytellerModel.Project, publicID *string) error {
	if publicID == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*publicID)
	if trimmed == "" {
		project.CoverAssetID = nil
		return nil
	}
	asset, err := s.repo.Asset(project.ID, trimmed)
	if err != nil {
		if repository.IsRecordNotFound(err) {
			return errors.New("找不到這個資產，或它不屬於這個專案。")
		}
		return err
	}
	if asset.AssetType != storytellerModel.AssetTypeImage {
		return errors.New("封面只能使用圖片資產。")
	}
	project.CoverAssetID = &asset.ID
	return nil
}

// syncProjectCoverReferences 依當下 CoverAssetID 重寫 project_cover 引用。
func (s *Service) syncProjectCoverReferences(project *storytellerModel.Project) error {
	if project.CoverAssetID == nil {
		return s.repo.ReplaceAssetReferences(assetReferenceTargetProjectCover, project.ID, nil)
	}
	assets, err := s.repo.AssetsByIDs([]uint64{*project.CoverAssetID})
	if err != nil {
		return err
	}
	if len(assets) == 0 {
		return s.repo.ReplaceAssetReferences(assetReferenceTargetProjectCover, project.ID, nil)
	}
	asset := assets[0]
	return s.repo.ReplaceAssetReferences(assetReferenceTargetProjectCover, project.ID, []storytellerModel.AssetReference{{
		AssetID:      asset.ID,
		TargetType:   assetReferenceTargetProjectCover,
		TargetID:     project.ID,
		ReferenceKey: asset.PublicID,
	}})
}

// existingCoverAssetPublicID 把專案目前的封面資產轉成 public_id，給 Patch 帶回去。
func (s *Service) existingCoverAssetPublicID(project storytellerModel.Project) (*string, error) {
	if project.CoverAssetID == nil {
		return nil, nil
	}
	assets, err := s.repo.AssetsByIDs([]uint64{*project.CoverAssetID})
	if err != nil {
		return nil, err
	}
	if len(assets) == 0 {
		return nil, nil
	}
	publicID := assets[0].PublicID
	return &publicID, nil
}

// attachProjectCovers 批次補封面 public_id／簽名 URL；簽名失敗只略過該筆。
func (s *Service) attachProjectCovers(outputs []*storytellerModel.ProjectOutput) error {
	ids := make([]uint64, 0, len(outputs))
	seen := map[uint64]bool{}
	for _, output := range outputs {
		if output == nil || output.CoverAssetID == nil {
			continue
		}
		id := *output.CoverAssetID
		if seen[id] {
			continue
		}
		seen[id] = true
		ids = append(ids, id)
	}
	assetsByID := map[uint64]storytellerModel.Asset{}
	if len(ids) > 0 {
		rows, err := s.repo.AssetsByIDs(ids)
		if err != nil {
			return err
		}
		for _, row := range rows {
			assetsByID[row.ID] = row
		}
	}
	for _, output := range outputs {
		if output == nil {
			continue
		}
		coverID := output.CoverAssetID
		output.CoverAssetID = nil
		if coverID == nil {
			continue
		}
		asset, ok := assetsByID[*coverID]
		if !ok || asset.AssetType != storytellerModel.AssetTypeImage {
			continue
		}
		output.CoverAssetPublicID = asset.PublicID
		url, err := signImageURL(asset.S3Key)
		if err != nil {
			log.Logger().Warn("Storyteller project cover sign failed",
				zap.String("project_public_id", output.PublicID),
				zap.String("asset_public_id", asset.PublicID),
				zap.Error(err),
			)
			continue
		}
		output.CoverURL = url
	}
	return nil
}

type signedProjectCover struct {
	AssetPublicID string
	URL           string
}

// signedCoversByProjectPublicID 依專案 public_id 批次簽封面；失敗只記 log。
func (s *Service) signedCoversByProjectPublicID(projectPublicIDs []string) map[string]signedProjectCover {
	covers := map[string]signedProjectCover{}
	if len(projectPublicIDs) == 0 {
		return covers
	}
	projects, err := s.repo.ProjectsByPublicIDs(projectPublicIDs)
	if err != nil {
		log.Logger().Warn("Storyteller search project cover lookup failed", zap.Error(err))
		return covers
	}
	assetIDs := make([]uint64, 0, len(projects))
	seen := map[uint64]bool{}
	for _, project := range projects {
		if project.CoverAssetID == nil || seen[*project.CoverAssetID] {
			continue
		}
		seen[*project.CoverAssetID] = true
		assetIDs = append(assetIDs, *project.CoverAssetID)
	}
	assetsByID := map[uint64]storytellerModel.Asset{}
	if len(assetIDs) > 0 {
		rows, err := s.repo.AssetsByIDs(assetIDs)
		if err != nil {
			log.Logger().Warn("Storyteller search project cover assets failed", zap.Error(err))
			return covers
		}
		for _, row := range rows {
			assetsByID[row.ID] = row
		}
	}
	for _, project := range projects {
		if project.CoverAssetID == nil {
			continue
		}
		asset, ok := assetsByID[*project.CoverAssetID]
		if !ok || asset.AssetType != storytellerModel.AssetTypeImage {
			continue
		}
		cover := signedProjectCover{AssetPublicID: asset.PublicID}
		url, err := signImageURL(asset.S3Key)
		if err != nil {
			log.Logger().Warn("Storyteller project cover sign failed",
				zap.String("project_public_id", project.PublicID),
				zap.String("asset_public_id", asset.PublicID),
				zap.Error(err),
			)
		} else {
			cover.URL = url
		}
		covers[project.PublicID] = cover
	}
	return covers
}
