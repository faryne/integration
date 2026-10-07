package storyteller

import (
	"sort"
	"strings"

	storytellerModel "faryne.dev/model/entity/storyteller"
	storytellerRepo "faryne.dev/repository/storyteller"
)

// SitemapData 是 SteamLoom sitemap 需要的公開內容，可見性規則跟閱讀頁一致
type SitemapData struct {
	Projects []storytellerModel.Project
	Stories  []storytellerRepo.SitemapItem
	Lores    []storytellerRepo.SitemapItem
	PenNames []string
}

// Sitemap 每一類各自最多 limit 筆；總數上限由呼叫端控管
func (s *Service) Sitemap(limit int) (*SitemapData, error) {
	projects, err := s.repo.PublicProjects()
	if err != nil {
		return nil, err
	}
	stories, err := s.repo.SitemapStories(limit)
	if err != nil {
		return nil, err
	}
	lores, err := s.repo.SitemapLores(limit)
	if err != nil {
		return nil, err
	}
	penNames, err := s.repo.SitemapAuthorPenNames(limit)
	if err != nil {
		return nil, err
	}
	return &SitemapData{Projects: projects, Stories: stories, Lores: lores, PenNames: penNames}, nil
}

// StoryFirstPageImage 給 SNS 預覽圖卡用：回傳圖像話第一頁（依 sort）的簽名網址，
// 以及不隨簽名變動的識別字（asset public_id，舊資料沒有就用 S3 key），讓圖卡快取能跨簽名沿用。
// 文字故事、沒有頁面或簽名失敗一律 ok=false，由呼叫端退回專案封面。
func (s *Service) StoryFirstPageImage(projectID uint64, story storytellerModel.Story) (cacheID, url string, ok bool) {
	if story.ContentType != storytellerModel.ProjectContentTypeImage {
		return "", "", false
	}
	pages := mustParseImageContent(story.LatestContent).Pages
	if len(pages) == 0 {
		return "", "", false
	}
	sort.SliceStable(pages, func(i, j int) bool { return pages[i].Sort < pages[j].Sort })
	page := pages[0]
	key, assetID := strings.TrimSpace(page.Key), strings.TrimSpace(page.AssetPublicID)
	if key == "" && assetID != "" {
		assets, err := s.assetsByPublicID(projectID, []string{assetID})
		if err != nil {
			return "", "", false
		}
		key = assets[assetID].S3Key
	}
	if key == "" {
		return "", "", false
	}
	signed, err := signImageURL(key)
	if err != nil {
		return "", "", false
	}
	if assetID == "" {
		assetID = key
	}
	return assetID, signed, true
}
