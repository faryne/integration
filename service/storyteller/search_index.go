package storyteller

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"faryne.dev/config"
	storytellerModel "faryne.dev/model/entity/storyteller"
	"faryne.dev/model/enum"
	"faryne.dev/service/client"
	"faryne.dev/service/log"
)

// searchWorksIndex 是文字故事／圖像作品共用的搜尋索引，一篇一般故事（非冊）對應一筆文件，
// 沒有另外拆 text/image 兩套索引。名字讀環境變數（STORYTELLER_SEARCH_INDEX），本機開發
// 可以蓋成不同名字，避免跟正式環境共用同一個 ES cluster 時互相污染資料。
func searchWorksIndex() string {
	return config.EnvConfig().StorytellerSearchIndex
}

// searchWorksIndexMapping 明確指定 analyzer，不能靠 dynamic mapping：中文全文欄位
// （title/summary/content/project_name）用 ES 內建的 cjk analyzer（bigram，不需要另外裝
// IK 之類的分詞外掛，繁簡體都不是問題）；tags／author_pen_name 保留 .keyword 子欄位是為了
// 配合程式碼裡 tags.keyword／author_pen_name.keyword 這種精準篩選查詢；story_public_id／
// project_public_id／project_slug／rating 直接是 keyword，不能再加 .keyword 尾巴；
// cover_image_key 設 index:false，這欄位從來不被拿來查詢。
const searchWorksIndexMapping = `{
  "mappings": {
    "properties": {
      "story_public_id": { "type": "keyword" },
      "project_public_id": { "type": "keyword" },
      "project_slug": { "type": "keyword" },
      "project_name": {
        "type": "text",
        "analyzer": "cjk",
        "fields": { "keyword": { "type": "keyword" } }
      },
      "title": { "type": "text", "analyzer": "cjk" },
      "summary": { "type": "text", "analyzer": "cjk" },
      "content": { "type": "text", "analyzer": "cjk" },
      "tags": {
        "type": "text",
        "analyzer": "cjk",
        "fields": { "keyword": { "type": "keyword" } }
      },
      "rating": { "type": "keyword" },
      "author_pen_name": {
        "type": "text",
        "analyzer": "cjk",
        "fields": { "keyword": { "type": "keyword" } }
      },
      "cover_image_key": { "type": "keyword", "index": false },
      "created_at": { "type": "date" },
      "updated_at": { "type": "date" }
    }
  }
}`

// CreateSearchIndex 建立搜尋索引，indexName 留空就用 STORYTELLER_SEARCH_INDEX 設定的名字。
// 供 main.go 的手動指令（-cmd=storyteller-search-create-index）呼叫，環境遷移／本機另開
// 一個測試用 index 時不用再手動打 curl、憑印象記 mapping 長怎樣。
func CreateSearchIndex(ctx context.Context, indexName string) error {
	if strings.TrimSpace(indexName) == "" {
		indexName = searchWorksIndex()
	}
	es := client.GetElasticSearch(enum.ESDefault)
	if es == nil {
		return fmt.Errorf("elasticsearch client is not initialized")
	}
	resp, err := es.Indices.Create(
		indexName,
		es.Indices.Create.WithContext(ctx),
		es.Indices.Create.WithBody(strings.NewReader(searchWorksIndexMapping)),
	)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.IsError() {
		return fmt.Errorf("create storyteller search index failed: status=%s index=%s", resp.Status(), indexName)
	}
	return nil
}

// RunCreateStorytellerSearchIndex 是 main.go 手動指令的入口，比照 RunSyncStorytellerSearchIndex
// 同一種寫法。indexName 留空就用預設 index。
func RunCreateStorytellerSearchIndex(indexName string) {
	if err := CreateSearchIndex(context.Background(), indexName); err != nil {
		log.Logger().Error("Storyteller search index create failed: " + err.Error())
	}
}

// workSearchDocument 是索引文件的形狀。CoverImageKey 只有圖像作品會有值（第一頁的 S3 key，
// 前端要自己簽名成可讀網址，不能把簽名網址存進索引——CloudFront 簽名網址有效期限很短，
// 讀取當下才簽（見 signImageURL），落地存進索引的話很快就會過期失效。
type workSearchDocument struct {
	StoryPublicID   string   `json:"story_public_id"`
	ProjectPublicID string   `json:"project_public_id"`
	ProjectSlug     string   `json:"project_slug"`
	ProjectName     string   `json:"project_name"`
	Title           string   `json:"title"`
	Summary         string   `json:"summary"`
	Content         string   `json:"content"`
	Tags            []string `json:"tags"`
	Rating          string   `json:"rating"`
	AuthorPenName   string   `json:"author_pen_name"`
	CoverImageKey   string   `json:"cover_image_key,omitempty"`
	// 存 RFC3339 字串而不是 unix timestamp：dynamic mapping 會自動把它偵測成 date 型別
	// （排序照樣可以用），API 輸出也可以直接原樣回傳給前端，不用另外轉換格式。
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

// storyPubliclyVisible 判斷一篇一般故事現在是不是讀者看得到：專案要 public、故事本身要
// completed，如果掛在一冊底下，那個冊也要是 completed（冊 draft 會級聯關掉底下所有故事，
// 邏輯對應 Repository.PublishedStories 的過濾條件，這裡是單篇故事版本）。
func storyPubliclyVisible(project *storytellerModel.Project, story *storytellerModel.Story, parentVolume *storytellerModel.Story) bool {
	if project == nil || story == nil || story.IsVolume {
		return false
	}
	if project.Visibility != storytellerModel.ProjectVisibilityPublic {
		return false
	}
	if story.Status != storytellerModel.StoryStatusCompleted {
		return false
	}
	if parentVolume != nil && parentVolume.Status != storytellerModel.StoryStatusCompleted {
		return false
	}
	return true
}

// storyIndexContent 依內容類型組出搜尋用的本文：文字故事拿掉 WYSIWYG marker 語法後的
// 純文字；圖像作品把每頁 Description 依 sort 串接，同時回傳第一頁的圖片 key 當封面。
func storyIndexContent(story *storytellerModel.Story) (content string, coverImageKey string, err error) {
	if story.ContentType != storytellerModel.ProjectContentTypeImage {
		return plainTextFromStoryContent(story.LatestContent), "", nil
	}
	var imageContent storytellerModel.StoryImageContent
	if strings.TrimSpace(story.LatestContent) != "" {
		if err := json.Unmarshal([]byte(story.LatestContent), &imageContent); err != nil {
			return "", "", fmt.Errorf("parse image story content: %w", err)
		}
	}
	pages := append([]storytellerModel.StoryImagePage(nil), imageContent.Pages...)
	sort.Slice(pages, func(i, j int) bool { return pages[i].Sort < pages[j].Sort })
	descriptions := make([]string, 0, len(pages))
	for _, page := range pages {
		if d := strings.TrimSpace(page.Description); d != "" {
			descriptions = append(descriptions, d)
		}
	}
	if len(pages) > 0 {
		coverImageKey = pages[0].Key
	}
	return strings.Join(descriptions, "\n"), coverImageKey, nil
}

// plainTextFromStoryContent 逐行拿掉段落／行內 marker 語法，只留讀者實際看得到的文字。
// 搜尋索引保留圖片 alt/title，避免資產命名從索引裡消失。
func plainTextFromStoryContent(raw string) string {
	if strings.TrimSpace(raw) == "" {
		return ""
	}
	lines := strings.Split(raw, "\n")
	cleaned := make([]string, 0, len(lines))
	for _, line := range lines {
		cleaned = append(cleaned, stripSearchIndexLineMarker(line))
	}
	return strings.Join(cleaned, "\n")
}

func buildWorkDocument(project *storytellerModel.Project, story *storytellerModel.Story, authorPenName string) (*workSearchDocument, error) {
	content, coverImageKey, err := storyIndexContent(story)
	if err != nil {
		return nil, err
	}
	return &workSearchDocument{
		StoryPublicID:   story.PublicID,
		ProjectPublicID: project.PublicID,
		ProjectSlug:     project.Slug,
		ProjectName:     project.Name,
		Title:           story.Title,
		Summary:         story.Summary,
		Content:         content,
		Tags:            decodeProjectTags(project.Tags),
		Rating:          string(project.Rating),
		AuthorPenName:   authorPenName,
		CoverImageKey:   coverImageKey,
		CreatedAt:       story.CreatedAt.Format(time.RFC3339),
		UpdatedAt:       story.UpdatedAt.Format(time.RFC3339),
	}, nil
}

func (s *Service) authorPenNameForIndex(userID uint64) string {
	profile, err := s.repo.UserProfile(userID)
	if err != nil || profile == nil {
		return ""
	}
	return profile.PenName
}

// syncStorySearchIndex 依故事目前的公開狀態決定要寫入索引還是從索引移除，一般故事存檔的
// 寫入路徑（CreateStory／UpdateStory／RevertStory）呼叫。ES 索引失敗只記錄錯誤、不擋下
// 存檔——搜尋索引是附加功能，作者存稿不該因為 ES 不可用就失敗，這點刻意跟
// service/nekomaid 那種抓取任務（ES 失敗直接讓整個 job fail）不同。
func (s *Service) syncStorySearchIndex(project *storytellerModel.Project, story *storytellerModel.Story) {
	ctx := context.Background()
	var parentVolume *storytellerModel.Story
	if story.ParentID != nil {
		volume, err := s.repo.StoryByID(*story.ParentID)
		if err != nil {
			log.Logger().Error("storyteller search index: load parent volume failed: " + err.Error())
			return
		}
		parentVolume = volume
	}
	if !storyPubliclyVisible(project, story, parentVolume) {
		if err := deleteWorkDocument(ctx, story.PublicID); err != nil {
			log.Logger().Error("storyteller search index: delete document failed: " + err.Error())
		}
		return
	}
	doc, err := buildWorkDocument(project, story, s.authorPenNameForIndex(project.UserID))
	if err != nil {
		log.Logger().Error("storyteller search index: build document failed: " + err.Error())
		return
	}
	if err := indexWorkDocument(ctx, doc); err != nil {
		log.Logger().Error("storyteller search index: index document failed: " + err.Error())
	}
}

func (s *Service) removeStorySearchDocument(storyPublicID string) {
	if err := deleteWorkDocument(context.Background(), storyPublicID); err != nil {
		log.Logger().Error("storyteller search index: delete document failed: " + err.Error())
	}
}

// resyncProjectSearchIndex 整個專案的搜尋索引重新同步：先清掉這個專案在索引裡的所有文件，
// 如果專案目前是公開的，再把所有符合公開條件的故事重新寫入。用在專案的可見度／名稱／
// 標籤／分級變動（UpdateProject）跟冊的公開狀態切換（UpdateVolume——冊 draft/completed
// 會級聯影響底下所有故事，沒辦法只同步單一文件），這兩種都不是高頻操作，用全量重算換
// 邏輯簡單、不用另外寫增量比對。
func (s *Service) resyncProjectSearchIndex(project *storytellerModel.Project) {
	ctx := context.Background()
	if err := deleteWorksByProject(ctx, project.PublicID); err != nil {
		log.Logger().Error("storyteller search index: resync delete failed: " + err.Error())
		return
	}
	if project.Visibility != storytellerModel.ProjectVisibilityPublic {
		return
	}
	stories, err := s.repo.PublishedStories(project.ID)
	if err != nil {
		log.Logger().Error("storyteller search index: load published stories failed: " + err.Error())
		return
	}
	authorPenName := s.authorPenNameForIndex(project.UserID)
	for i := range stories {
		doc, err := buildWorkDocument(project, &stories[i], authorPenName)
		if err != nil {
			log.Logger().Error("storyteller search index: build document failed: " + err.Error())
			continue
		}
		if err := indexWorkDocument(ctx, doc); err != nil {
			log.Logger().Error("storyteller search index: index document failed: " + err.Error())
		}
	}
}

func (s *Service) removeProjectSearchIndex(projectPublicID string) {
	if err := deleteWorksByProject(context.Background(), projectPublicID); err != nil {
		log.Logger().Error("storyteller search index: remove project failed: " + err.Error())
	}
}

// SyncAllStorytellerSearchIndex 是搜尋索引的全量回填工具：清掉再重建每個公開專案在
// storyteller_works 索引裡的所有文件。給 main.go 的手動指令（-cmd=storyteller-search-sync）
// 呼叫，第一次上線索引、或 mapping／索引邏輯調整後需要重新回填既有資料時用。
func (s *Service) SyncAllStorytellerSearchIndex() error {
	projects, err := s.repo.PublicProjects()
	if err != nil {
		return err
	}
	for i := range projects {
		s.resyncProjectSearchIndex(&projects[i])
	}
	return nil
}

// RunSyncStorytellerSearchIndex 是 main.go 手動指令（-cmd=storyteller-search-sync）的入口，
// 比照 RunRotateStorytellerAgentAPIKeys 同一種寫法。
func RunSyncStorytellerSearchIndex() {
	if err := NewService().SyncAllStorytellerSearchIndex(); err != nil {
		log.Logger().Error("Storyteller search index sync failed: " + err.Error())
	}
}

func indexWorkDocument(ctx context.Context, doc *workSearchDocument) error {
	es := client.GetElasticSearch(enum.ESDefault)
	if es == nil {
		return fmt.Errorf("elasticsearch client is not initialized")
	}
	body, err := json.Marshal(doc)
	if err != nil {
		return err
	}
	resp, err := es.Index(
		searchWorksIndex(),
		bytes.NewReader(body),
		es.Index.WithContext(ctx),
		es.Index.WithDocumentID(doc.StoryPublicID),
		es.Index.WithRefresh("true"),
	)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.IsError() {
		return fmt.Errorf("index storyteller work failed: status=%s document_id=%s", resp.Status(), doc.StoryPublicID)
	}
	return nil
}

func deleteWorkDocument(ctx context.Context, storyPublicID string) error {
	es := client.GetElasticSearch(enum.ESDefault)
	if es == nil {
		return fmt.Errorf("elasticsearch client is not initialized")
	}
	resp, err := es.Delete(
		searchWorksIndex(),
		storyPublicID,
		es.Delete.WithContext(ctx),
		es.Delete.WithRefresh("true"),
	)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.IsError() && resp.StatusCode != http.StatusNotFound {
		return fmt.Errorf("delete storyteller work failed: status=%s document_id=%s", resp.Status(), storyPublicID)
	}
	return nil
}

func deleteWorksByProject(ctx context.Context, projectPublicID string) error {
	es := client.GetElasticSearch(enum.ESDefault)
	if es == nil {
		return fmt.Errorf("elasticsearch client is not initialized")
	}
	query := map[string]any{
		"query": map[string]any{
			"match": map[string]any{"project_public_id": projectPublicID},
		},
	}
	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(query); err != nil {
		return err
	}
	resp, err := es.DeleteByQuery(
		[]string{searchWorksIndex()},
		&buf,
		es.DeleteByQuery.WithContext(ctx),
		es.DeleteByQuery.WithRefresh(true),
		es.DeleteByQuery.WithIgnoreUnavailable(true),
	)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.IsError() {
		return fmt.Errorf("delete storyteller works by project failed: status=%s project_public_id=%s", resp.Status(), projectPublicID)
	}
	return nil
}
