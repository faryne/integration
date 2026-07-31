package storyteller

import (
	"fmt"
	"strings"

	"faryne.dev/model/entity"
	"faryne.dev/service/helper"
	"faryne.dev/service/search"
)

// SearchResultPageSize 是預設／上限的每頁筆數，跟 controller 組分頁參數共用同一個常數。
const SearchResultPageSize = 20

type WorkSearchRequest struct {
	entity.CommonPaginationQueryRequest
	Keyword string `query:"keyword"`
	Tag     string `query:"tag"`
	Rating  string `query:"rating"`
	Author  string `query:"author"`
	Cursor  string `query:"cursor"`
}

// WorkSearchResult 是搜尋結果給前端用的形狀。CoverImageURL 是查詢當下才簽的 CloudFront
// 網址（索引裡存的只是 S3 key），文字故事沒有這個欄位。
type WorkSearchResult struct {
	StoryPublicID   string   `json:"story_public_id"`
	ProjectPublicID string   `json:"project_public_id"`
	ProjectName     string   `json:"project_name"`
	Title           string   `json:"title"`
	Summary         string   `json:"summary"`
	Tags            []string `json:"tags"`
	Rating          string   `json:"rating"`
	AuthorPenName   string   `json:"author_pen_name"`
	CoverImageURL   string   `json:"cover_image_url,omitempty"`
}

func workSearchResultFromDocument(doc workSearchDocument) WorkSearchResult {
	result := WorkSearchResult{
		StoryPublicID:   doc.StoryPublicID,
		ProjectPublicID: doc.ProjectPublicID,
		ProjectName:     doc.ProjectName,
		Title:           doc.Title,
		Summary:         doc.Summary,
		Tags:            doc.Tags,
		Rating:          doc.Rating,
		AuthorPenName:   doc.AuthorPenName,
	}
	if doc.CoverImageKey != "" {
		if url, err := signImageURL(doc.CoverImageKey); err == nil {
			result.CoverImageURL = url
		}
	}
	return result
}

// SearchWorks 用 storyteller_works 索引做全站作品搜尋（文字故事／圖像作品共用同一套）：
// keyword 對 title／summary／project_name／content 做 multi_match，tag/rating/author 是
// 精準篩選，用 .keyword 子欄位比對（dynamic mapping 預設會生成，跟 service/nekomaid
// 的 tags.keyword 用法一致）。回傳的 currentOffset 給 controller 組分頁用。
func (s *Service) SearchWorks(req WorkSearchRequest) (raw *entity.ElasticSearchResponse[workSearchDocument], rows []WorkSearchResult, currentOffset int64, err error) {
	keyword := strings.TrimSpace(req.Keyword)
	tag := strings.TrimSpace(req.Tag)
	rating := strings.TrimSpace(req.Rating)
	author := strings.TrimSpace(req.Author)
	cursorValue := strings.TrimSpace(req.Cursor)
	perPage := req.PerPageValue(SearchResultPageSize)

	currentOffset = (req.PageValue() - 1) * perPage
	q := map[string]any{
		"size": perPage,
		"sort": []map[string]any{
			{"updated_at": map[string]any{"order": "desc"}},
			{"story_public_id.keyword": map[string]any{"order": "desc"}},
		},
	}
	if cursorValue == "" {
		q["from"] = currentOffset
	} else {
		cursor, decodeErr := helper.DecodeESCursor(cursorValue)
		if decodeErr != nil {
			return nil, nil, 0, fmt.Errorf("cursor is invalid")
		}
		if cursor != nil {
			q["search_after"] = cursor.SearchAfter
			currentOffset = cursor.Offset
		}
	}
	if keyword != "" {
		search.SetQuery(map[string]any{
			"multi_match": map[string]any{
				"query":  keyword,
				"fields": []string{"title^3", "summary^2", "project_name^2", "content"},
			},
		}, true, q)
	}
	if tag != "" {
		search.SetQuery(map[string]any{"match": map[string]any{"tags.keyword": tag}}, true, q)
	}
	if rating != "" {
		search.SetQuery(map[string]any{"match": map[string]any{"rating": rating}}, true, q)
	}
	if author != "" {
		search.SetQuery(map[string]any{"match": map[string]any{"author_pen_name.keyword": author}}, true, q)
	}

	raw, docs, err := search.Search[workSearchDocument, WorkSearchResult](searchWorksIndex, q, workSearchResultFromDocument)
	if err != nil {
		return nil, nil, 0, err
	}
	return raw, docs, currentOffset, nil
}
