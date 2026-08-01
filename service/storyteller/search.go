package storyteller

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"strings"

	"faryne.dev/model/entity"
	"faryne.dev/model/enum"
	"faryne.dev/service/client"
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
	ProjectSlug     string   `json:"project_slug"`
	ProjectName     string   `json:"project_name"`
	Title           string   `json:"title"`
	Summary         string   `json:"summary"`
	Tags            []string `json:"tags"`
	Rating          string   `json:"rating"`
	AuthorPenName   string   `json:"author_pen_name"`
	CoverImageURL   string   `json:"cover_image_url,omitempty"`
	UpdatedAt       string   `json:"updated_at"`
}

func workSearchResultFromDocument(doc workSearchDocument) WorkSearchResult {
	result := WorkSearchResult{
		StoryPublicID:   doc.StoryPublicID,
		ProjectPublicID: doc.ProjectPublicID,
		ProjectSlug:     doc.ProjectSlug,
		ProjectName:     doc.ProjectName,
		Title:           doc.Title,
		Summary:         doc.Summary,
		Tags:            doc.Tags,
		Rating:          doc.Rating,
		AuthorPenName:   doc.AuthorPenName,
		UpdatedAt:       doc.UpdatedAt,
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
			// story_public_id 本身就是 keyword 型別（見 search_index.go 的 mapping），
			// 不是 dynamic mapping 那種 text+keyword 多欄位，不能寫成 story_public_id.keyword
			// ——ES 對不存在的排序欄位會回錯誤，而 service/search.Search 目前不檢查回應
			// 是不是錯誤，會把錯誤 JSON 硬解成空結果，變成「200 OK 但 0 筆」不容易發現。
			{"story_public_id": map[string]any{"order": "desc"}},
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
	applyWorkSearchFilters(q, keyword, tag, rating, author)

	raw, docs, err := search.Search[workSearchDocument, WorkSearchResult](searchWorksIndex, q, workSearchResultFromDocument)
	if err != nil {
		return nil, nil, 0, err
	}
	return raw, docs, currentOffset, nil
}

// applyWorkSearchFilters 是 SearchWorks／SearchProjectsGrouped 共用的篩選條件，兩邊查詢
// 條件完全一樣，差別只在有沒有 collapse 成專案，抽出來避免兩處各寫一份容易漏改。
func applyWorkSearchFilters(q map[string]any, keyword, tag, rating, author string) {
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
}

// ProjectSearchResult 是「依專案分組」搜尋結果的單筆項目：Matches 是這個專案裡命中的
// 故事（最多 projectSearchMatchesPerGroup 篇，依同一套排序取前幾筆），MatchedStoryCount
// 是這個專案總共有幾篇故事命中（可能比 Matches 顯示的還多）。
type ProjectSearchResult struct {
	ProjectPublicID   string             `json:"project_public_id"`
	ProjectSlug       string             `json:"project_slug"`
	ProjectName       string             `json:"project_name"`
	Rating            string             `json:"rating"`
	Tags              []string           `json:"tags"`
	AuthorPenName     string             `json:"author_pen_name"`
	MatchedStoryCount int64              `json:"matched_story_count"`
	Matches           []WorkSearchResult `json:"matches"`
}

const projectSearchMatchesPerGroup = 3

// projectGroupedSearchResponse 是 collapse+inner_hits+cardinality aggregation 組合查詢的
// 原始回應形狀，跟 entity.ElasticSearchResponse 泛型不相容（那個型別沒有 inner_hits 欄位），
// 所以這裡另外定義、直接用 client.GetElasticSearch 手動查，不透過 service/search.Search。
type projectGroupedSearchResponse struct {
	Hits struct {
		Total struct {
			Value int64 `json:"value"`
		} `json:"total"`
		Hits []struct {
			Source    workSearchDocument `json:"_source"`
			Sort      []any              `json:"sort"`
			InnerHits struct {
				Matches struct {
					Hits struct {
						Total struct {
							Value int64 `json:"value"`
						} `json:"total"`
						Hits []struct {
							Source workSearchDocument `json:"_source"`
						} `json:"hits"`
					} `json:"hits"`
				} `json:"matches"`
			} `json:"inner_hits"`
		} `json:"hits"`
	} `json:"hits"`
	Aggregations struct {
		ProjectCount struct {
			Value float64 `json:"value"`
		} `json:"project_count"`
	} `json:"aggregations"`
}

// SearchProjectsGrouped 是 SearchWorks 的「依專案分組」版本：篩選條件完全一樣
// （applyWorkSearchFilters），差別是用 ES `collapse` 依 project_public_id 把同一個專案的
// 多篇命中故事收成一組，`inner_hits` 附帶抓出該專案前幾篇命中故事，加上一個
// cardinality aggregation 算出總共有幾個專案命中（collapse 本身的 hits.total 算的是
// collapse 前的文件數，不是分組數，不能直接拿來當分頁用的 total）。
func (s *Service) SearchProjectsGrouped(req WorkSearchRequest) (results []ProjectSearchResult, total int64, currentOffset int64, nextSearchAfter []any, err error) {
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
			{"project_public_id": map[string]any{"order": "desc"}},
		},
		"collapse": map[string]any{
			"field": "project_public_id",
			"inner_hits": map[string]any{
				"name": "matches",
				"size": projectSearchMatchesPerGroup,
				"sort": []map[string]any{
					{"updated_at": map[string]any{"order": "desc"}},
				},
			},
		},
		"aggregations": map[string]any{
			"project_count": map[string]any{
				"cardinality": map[string]any{"field": "project_public_id"},
			},
		},
	}
	if cursorValue == "" {
		q["from"] = currentOffset
	} else {
		cursor, decodeErr := helper.DecodeESCursor(cursorValue)
		if decodeErr != nil {
			return nil, 0, 0, nil, fmt.Errorf("cursor is invalid")
		}
		if cursor != nil {
			q["search_after"] = cursor.SearchAfter
			currentOffset = cursor.Offset
		}
	}
	applyWorkSearchFilters(q, keyword, tag, rating, author)

	raw, err := rawSearch(context.Background(), q)
	if err != nil {
		return nil, 0, 0, nil, err
	}

	results = make([]ProjectSearchResult, 0, len(raw.Hits.Hits))
	for _, hit := range raw.Hits.Hits {
		matches := make([]WorkSearchResult, 0, len(hit.InnerHits.Matches.Hits.Hits))
		for _, innerHit := range hit.InnerHits.Matches.Hits.Hits {
			matches = append(matches, workSearchResultFromDocument(innerHit.Source))
		}
		results = append(results, ProjectSearchResult{
			ProjectPublicID:   hit.Source.ProjectPublicID,
			ProjectSlug:       hit.Source.ProjectSlug,
			ProjectName:       hit.Source.ProjectName,
			Rating:            hit.Source.Rating,
			Tags:              hit.Source.Tags,
			AuthorPenName:     hit.Source.AuthorPenName,
			MatchedStoryCount: hit.InnerHits.Matches.Hits.Total.Value,
			Matches:           matches,
		})
	}
	total = int64(raw.Aggregations.ProjectCount.Value)
	if len(raw.Hits.Hits) > 0 {
		nextSearchAfter = raw.Hits.Hits[len(raw.Hits.Hits)-1].Sort
	}
	return results, total, currentOffset, nextSearchAfter, nil
}

func rawSearch(ctx context.Context, query map[string]any) (*projectGroupedSearchResponse, error) {
	es := client.GetElasticSearch(enum.ESDefault)
	if es == nil {
		return nil, fmt.Errorf("elasticsearch client is not initialized")
	}
	var buf bytes.Buffer
	if err := json.NewEncoder(&buf).Encode(query); err != nil {
		return nil, err
	}
	resp, err := es.Search(
		es.Search.WithContext(ctx),
		es.Search.WithIndex(searchWorksIndex),
		es.Search.WithBody(&buf),
		es.Search.WithTrackTotalHits(true),
	)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.IsError() {
		return nil, fmt.Errorf("search storyteller works grouped by project failed: status=%s", resp.Status())
	}
	var parsed projectGroupedSearchResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, err
	}
	return &parsed, nil
}
