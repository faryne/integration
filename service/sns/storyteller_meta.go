package sns

import (
	"crypto/sha1"
	"encoding/hex"
	"fmt"
	"net/url"
	"regexp"
	"strings"

	modelSNS "faryne.dev/model/entity/sns"
	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/repository"
	"faryne.dev/service/log"
	"faryne.dev/service/storyteller"

	"go.uber.org/zap"
)

// SteamLoom（storyteller）的社群預覽：作品首頁／單篇故事／設定／作者頁的 meta，
// 讀者看不到的內容一律 404（平台就不會產生預覽卡），圖卡網址指向 og_image.go 的端點。

const (
	steamloomDefaultImagePath = "/steamloom-og-default.jpg"
	storytellerOGImageWidth   = 1200
	storytellerOGImageHeight  = 630
	// storytellerSpoilerLoreTitle 是含劇透設定在社群預覽與讀者列表上的替代標題
	storytellerSpoilerLoreTitle      = "含劇透的設定"
	storytellerNotFoundTitle         = "找不到這個頁面"
	storytellerNotFoundDescription   = "這個頁面不存在，或作者還沒公開。"
	storytellerRestrictedDescription = "此作品為限制級內容，需年滿 18 歲才能閱讀。"
)

var (
	// 分組：1＝share token、2＝內容種類（story/lore；image 是舊網址）、3＝內容 public_id；
	// 舊網址沒有種類前綴（work/share/:token/:id）時 2 為空，視為故事。
	storytellerSharePattern = regexp.MustCompile(`^/storyteller/(?:work|story)/share/([^/]+)(?:/(?:(story|image|lore)/)?([^/]+))?(?:/versions/[^/]+)?$`)
	// work/:project/(story|lore)/:id 是現行網址；分組同上（1＝專案路徑）。
	// 開頭的 story/、內容的 image/、沒有種類前綴的 /:id 都只保留舊外部連結的 meta 相容性。
	storytellerWorkPattern = regexp.MustCompile(`^/storyteller/(?:work|story)/([^/]+)(?:/(?:(story|image|lore)/)?([^/]+))?(?:/versions/[^/]+)?$`)
	// 舊網址沒有種類前綴時，這些是作品首頁的分頁，不是內容 public_id
	storytellerTabSegments = map[string]bool{"lores": true, "stories": true, "images": true}
)

// 測試時替換成假資料，不用真的連 DB
var (
	fetchStorytellerPublicProjectMeta = fetchStorytellerPublicProjectMetaFromService
	fetchStorytellerSharedProjectMeta = fetchStorytellerSharedProjectMetaFromService
	storytellerFirstPageImage         = func(projectID uint64, story storytellerModel.Story) (string, string, bool) {
		return storyteller.NewService().StoryFirstPageImage(projectID, story)
	}
)

type storytellerItemMeta struct {
	Title   string
	Summary string
	Author  string
	// imageStory 只有圖像話才帶，圖卡用它的第一頁
	imageStory *storytellerModel.Story
}

type storytellerProjectMeta struct {
	// ID 是內部流水號，只用來查圖像話頁面的資產，不會輸出
	ID          uint64
	Title       string
	Description string
	Author      string
	Restricted  bool
	// CoverAssetID 是封面的 asset public_id（圖卡快取用），CoverURL 是當下簽好的網址
	CoverAssetID string
	CoverURL     string
	Focal        storytellerModel.ProjectCoverFocalPoint
	// Items 以 storytellerItemKey 為 key，只含讀者看得到的故事與設定
	Items map[string]storytellerItemMeta
}

// storytellerTarget 是一個閱讀頁網址解析後的結果：NotFound＝讀者看不到（私人、草稿、未公開、不存在），
// Err＝暫時性錯誤（DB 等），這時不回 404，免得平台把一時的錯誤快取成「頁面不存在」。
type storytellerTarget struct {
	Project  storytellerProjectMeta
	Item     *storytellerItemMeta
	Shared   bool
	NotFound bool
	Err      error
}

// resolveStorytellerTarget 解析 work／share 網址並套用讀者可見性；第二個回傳值表示網址格式有沒有對上
func resolveStorytellerTarget(frontendPath string) (storytellerTarget, bool) {
	if m := storytellerSharePattern.FindStringSubmatch(frontendPath); m != nil {
		project, err := fetchStorytellerSharedProjectMeta(m[1])
		return newStorytellerTarget(project, err, m[2], m[3], true), true
	}
	if m := storytellerWorkPattern.FindStringSubmatch(frontendPath); m != nil {
		project, err := fetchStorytellerPublicProjectMeta(m[1])
		return newStorytellerTarget(project, err, m[2], m[3], false), true
	}
	return storytellerTarget{}, false
}

func newStorytellerTarget(project storytellerProjectMeta, err error, kind, itemID string, shared bool) storytellerTarget {
	target := storytellerTarget{Shared: shared}
	if err != nil {
		target.NotFound, target.Err = repository.IsRecordNotFound(err), err
		if target.NotFound {
			target.Err = nil
		}
		return target
	}
	target.Project = project
	// 作品首頁或分頁：作品層級
	if itemID == "" || (kind == "" && storytellerTabSegments[itemID]) {
		return target
	}
	// 網址明確指到某篇，但讀者看不到（草稿、未公開的設定、已刪除）→ 跟私人作品一樣 404
	item, ok := project.Items[storytellerItemKey(kind, itemID)]
	if !ok {
		target.NotFound = true
		return target
	}
	target.Item = &item
	return target
}

// applyStorytellerWorkMeta 作品首頁、單篇故事、單則設定（含分享連結）的 meta
func applyStorytellerWorkMeta(meta *modelSNS.Meta, matches []string) {
	target, _ := resolveStorytellerTarget(matches[0])
	if target.Shared {
		meta.Robots = "noindex, nofollow"
	}
	if target.NotFound {
		applyStorytellerNotFoundMeta(meta)
		return
	}
	if target.Err != nil {
		log.Logger().Warn("SNS storyteller meta fetch failed", zap.String("path", matches[0]), zap.Error(target.Err))
		return
	}
	project := target.Project
	title, description, author := strings.TrimSpace(project.Title), strings.TrimSpace(project.Description), project.Author
	// 分享單篇故事或單則設定時，預覽卡顯示「篇名 | 作品名」與該篇摘要
	if item := target.Item; item != nil && strings.TrimSpace(item.Title) != "" {
		title = strings.TrimSpace(item.Title) + " | " + title
		if summary := strings.TrimSpace(item.Summary); summary != "" {
			description = summary
		}
		if item.Author != "" {
			author = item.Author
		}
		meta.SchemaType = "CreativeWork"
	}
	meta.Title = fullTitleForSite(title, meta.SiteName)
	if description != "" {
		meta.Description = description
	}
	meta.Type = "article"
	meta.AuthorName = author
	// 限制級：標題保留，描述換成年齡提示，圖維持品牌預設圖（不出封面）
	if project.Restricted {
		meta.Description = storytellerRestrictedDescription
		return
	}
	if source, ok := storytellerImage(target); ok {
		meta.Image = storytellerOGImageURL(meta.Canonical, source.version())
		meta.ImageWidth, meta.ImageHeight = storytellerOGImageWidth, storytellerOGImageHeight
	}
}

// applyStorytellerNotFoundMeta 讀者看不到的頁面：回 404，不帶任何作品資訊
func applyStorytellerNotFoundMeta(meta *modelSNS.Meta) {
	meta.Status = 404
	meta.Title = fullTitleForSite(storytellerNotFoundTitle, meta.SiteName)
	meta.Description = storytellerNotFoundDescription
	meta.Robots = "noindex, nofollow"
	meta.Type = "website"
	meta.SchemaType = "WebPage"
	meta.AuthorName = ""
}

// storytellerImageSource 是圖卡要用的原圖；cacheID 不隨簽名變動，跟焦點一起組成圖卡版本
type storytellerImageSource struct {
	cacheID string
	url     string
	focal   storytellerModel.ProjectCoverFocalPoint
}

// version 換封面、調焦點都會變，平台跟 Redis 的圖卡快取自然失效
func (s storytellerImageSource) version() string {
	sum := sha1.Sum([]byte(fmt.Sprintf("%s|%.3f|%.3f", s.cacheID, s.focal.X, s.focal.Y)))
	return hex.EncodeToString(sum[:])[:16]
}

// storytellerImage 選圖順序：圖像話第一頁 → 專案封面；都沒有就用品牌預設圖（回 false）
func storytellerImage(target storytellerTarget) (storytellerImageSource, bool) {
	if item := target.Item; item != nil && item.imageStory != nil {
		if cacheID, signed, ok := storytellerFirstPageImage(target.Project.ID, *item.imageStory); ok {
			// 頁面不是封面，沒有焦點設定，裁切時置中
			return storytellerImageSource{cacheID: cacheID, url: signed, focal: storytellerModel.ProjectCoverFocalPoint{X: 0.5, Y: 0.5}}, true
		}
	}
	if target.Project.CoverURL != "" && target.Project.CoverAssetID != "" {
		return storytellerImageSource{cacheID: target.Project.CoverAssetID, url: target.Project.CoverURL, focal: target.Project.Focal}, true
	}
	return storytellerImageSource{}, false
}

// storytellerOGImageURL 圖卡網址跟閱讀頁網址一一對應（/og-image + 閱讀頁路徑 + .jpg），
// 不放簽名網址：簽名一小時就過期，平台之後重抓圖會破圖
func storytellerOGImageURL(canonical, version string) string {
	parsed, err := url.Parse(canonical)
	if err != nil {
		return canonical
	}
	parsed.Path = "/og-image" + strings.TrimRight(parsed.Path, "/") + ".jpg"
	parsed.RawQuery = url.Values{"v": {version}}.Encode()
	return parsed.String()
}

// storytellerItemKey 把網址上的內容種類正規化：舊網址的 image/ 與沒有種類前綴的都是故事。
func storytellerItemKey(kind, itemID string) string {
	if kind != "lore" {
		kind = "story"
	}
	return kind + ":" + itemID
}

func fetchStorytellerPublicProjectMetaFromService(projectPath string) (storytellerProjectMeta, error) {
	project, err := storyteller.NewService().PublicProject(projectPath, 0)
	if err != nil {
		return storytellerProjectMeta{}, err
	}
	return storytellerProjectMetaFromOutput(project), nil
}

func fetchStorytellerSharedProjectMetaFromService(shareToken string) (storytellerProjectMeta, error) {
	project, err := storyteller.NewService().SharedProject(shareToken)
	if err != nil {
		return storytellerProjectMeta{}, err
	}
	return storytellerProjectMetaFromOutput(project), nil
}

// storytellerProjectMetaFromOutput 只收讀者看得到的內容：PublicProject／SharedProject 已經濾掉草稿與未公開的設定
func storytellerProjectMetaFromOutput(project *storytellerModel.ProjectOutput) storytellerProjectMeta {
	items := make(map[string]storytellerItemMeta, len(project.Stories)+len(project.Lores))
	for _, story := range project.Stories {
		if story.IsVolume {
			continue
		}
		item := storytellerItemMeta{Title: story.Title, Summary: story.Summary, Author: storytellerPenNames(story.Authors)}
		if story.ContentType == storytellerModel.ProjectContentTypeImage {
			copied := story
			item.imageStory = &copied
		}
		items[storytellerItemKey("story", story.PublicID)] = item
	}
	for _, lore := range project.Lores {
		item := storytellerItemMeta{Title: lore.Title, Summary: lore.Summary}
		// 含劇透的設定：標題與摘要本身就可能是劇透，社群預覽一律不帶出來
		if lore.IsSpoiler {
			item = storytellerItemMeta{Title: storytellerSpoilerLoreTitle}
		}
		items[storytellerItemKey("lore", lore.PublicID)] = item
	}
	authors := make([]storytellerModel.AuthorIdentityOutput, 0, len(project.Authors))
	for _, author := range project.Authors {
		authors = append(authors, author.AuthorIdentityOutput)
	}
	return storytellerProjectMeta{
		ID:           project.ID,
		Title:        project.Name,
		Description:  project.Description,
		Author:       storytellerPenNames(authors),
		Restricted:   project.Rating == storytellerModel.ProjectRatingRestricted,
		CoverAssetID: project.CoverAssetPublicID,
		CoverURL:     project.CoverURL,
		Focal:        project.CoverFocalPoint,
		Items:        items,
	}
}

func storytellerPenNames(authors []storytellerModel.AuthorIdentityOutput) string {
	names := make([]string, 0, len(authors))
	for _, author := range authors {
		if name := strings.TrimSpace(author.PenName); name != "" {
			names = append(names, name)
		}
	}
	return strings.Join(names, "、")
}
