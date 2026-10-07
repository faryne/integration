package storyteller

import (
	"errors"
	"fmt"
	"strings"
	"unicode/utf8"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

// loreSummaryMaxRunes 對應 storyteller_lores.summary 的 VARCHAR(500)
const loreSummaryMaxRunes = 500

// applyLorePublishing 把請求裡的公開狀態與摘要套到設定上；欄位省略（nil）就維持原值，
// 新建立的設定沒帶狀態時一律是草稿——gorm 建立時會明確寫入空字串，不會用到 DB 的 default。
func applyLorePublishing(lore *storytellerModel.Lore, input storytellerModel.LoreRequest) error {
	if input.Status != nil {
		switch *input.Status {
		case storytellerModel.StoryStatusDraft, storytellerModel.StoryStatusCompleted:
			lore.Status = *input.Status
		default:
			return errors.New("status 只能是 draft 或 completed")
		}
	}
	if lore.Status == "" {
		lore.Status = storytellerModel.StoryStatusDraft
	}
	if input.IsSpoiler != nil {
		lore.IsSpoiler = *input.IsSpoiler
	}
	if input.Summary != nil {
		summary := strings.TrimSpace(*input.Summary)
		if utf8.RuneCountInString(summary) > loreSummaryMaxRunes {
			return fmt.Errorf("摘要最多 %d 個字", loreSummaryMaxRunes)
		}
		lore.Summary = summary
	}
	return nil
}

// attachReaderLores 把閱讀頁要顯示的設定與設定集掛到專案輸出上：只放有內容可看的設定集，
// 設定內文裡的資產連結當下簽名（跟故事內文同一套），讀者不會拿到原始 S3 key。
func (s *Service) attachReaderLores(projectID uint64, output *storytellerModel.ProjectOutput, includeDrafts bool) error {
	lores, err := s.repo.ReaderLores(projectID, includeDrafts)
	if err != nil {
		return err
	}
	if err := s.fillLoreCollectionPublicIDs(projectID, lores); err != nil {
		return err
	}
	for i := range lores {
		if lores[i].LatestContent, err = s.signAssetURIsInContent(projectID, lores[i].LatestContent); err != nil {
			return err
		}
	}
	collections, err := s.repo.LoreCollections(projectID)
	if err != nil {
		return err
	}
	used := make(map[string]bool, len(lores))
	for _, lore := range lores {
		used[lore.CollectionPublicID] = true
	}
	output.LoreCollections = make([]storytellerModel.LoreCollection, 0, len(collections))
	for _, collection := range collections {
		if used[collection.PublicID] {
			output.LoreCollections = append(output.LoreCollections, collection)
		}
	}
	// 依賴只保留讀者讀得到的對象（output.Stories 已依同一套規則篩過），讀不到的視為已滿足
	ids := make([]uint64, 0, len(lores))
	for _, lore := range lores {
		ids = append(ids, lore.ID)
	}
	dependencies, err := s.repo.LoreDependencies(ids)
	if err != nil {
		return err
	}
	fillLoreDependencies(lores, dependencies, newLoreTargetDirectory(output.Stories, lores))
	output.Lores = lores
	return nil
}
