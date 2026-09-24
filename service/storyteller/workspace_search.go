package storyteller

import (
	"errors"
	"fmt"
	"regexp"
	"sort"
	"strings"
	"unicode"
	"unicode/utf8"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

const (
	workspaceSearchCandidateLimit = 60
	workspaceSearchPerKindLimit   = 20
	workspaceSearchResultLimit    = 40
	workspaceSearchKeywordLimit   = 100
)

var (
	ErrWorkspaceSearchKeywordTooLong = errors.New("workspace search keyword is too long")
	ErrWorkspaceSearchKindInvalid    = errors.New("workspace search kind is invalid")
	workspaceSearchCodeFenceRegexp   = regexp.MustCompile("(?m)^[\\t ]*```[^\\n]*$")
	workspaceSearchHeadingRegexp     = regexp.MustCompile(`(?m)^[\t ]{0,3}#{1,6}[\t ]+`)
	workspaceSearchInlineDelimiters  = []string{"**", "__", "++", "--", "*", "~", "^", "`"}
)

// SearchWorkspace 只搜尋登入者擁有的單一專案；公開搜尋仍走 Elasticsearch，兩者不能
// 共用索引，避免把私人草稿或資產資訊寫進公開作品索引。
func (s *Service) SearchWorkspace(userID uint64, projectPublicID, keyword string, kind storytellerModel.WorkspaceSearchKind) ([]storytellerModel.WorkspaceSearchResult, error) {
	keyword = strings.TrimSpace(keyword)
	if keyword == "" {
		return []storytellerModel.WorkspaceSearchResult{}, nil
	}
	if utf8.RuneCountInString(keyword) > workspaceSearchKeywordLimit {
		return nil, fmt.Errorf("%w: must not exceed %d characters", ErrWorkspaceSearchKeywordTooLong, workspaceSearchKeywordLimit)
	}
	if kind != "" && kind != storytellerModel.WorkspaceSearchKindStory && kind != storytellerModel.WorkspaceSearchKindLore && kind != storytellerModel.WorkspaceSearchKindAsset {
		return nil, ErrWorkspaceSearchKindInvalid
	}
	project, err := s.repo.ProjectByPublicIDForUser(userID, projectPublicID)
	if err != nil {
		return nil, err
	}

	sources := make([]storytellerModel.WorkspaceSearchSource, 0, workspaceSearchPerKindLimit*3)
	appendRows := func(rows []storytellerModel.WorkspaceSearchSource, searchErr error) error {
		if searchErr != nil {
			return searchErr
		}
		matched := 0
		for _, row := range rows {
			// SQL 只負責便宜的候選粗篩；marker、圖像作品 JSON key 等不可見內容要在
			// 轉成使用者實際看得到的純文字後再確認，避免結果與 Preview 對不起來。
			if !workspaceSearchSourceMatches(row, keyword) {
				continue
			}
			sources = append(sources, row)
			matched++
			if matched == workspaceSearchPerKindLimit {
				break
			}
		}
		return nil
	}
	if kind == "" || kind == storytellerModel.WorkspaceSearchKindStory {
		if err := appendRows(s.repo.WorkspaceSearchStories(project.ID, keyword, workspaceSearchCandidateLimit)); err != nil {
			return nil, err
		}
	}
	if kind == "" || kind == storytellerModel.WorkspaceSearchKindLore {
		if err := appendRows(s.repo.WorkspaceSearchLores(project.ID, keyword, workspaceSearchCandidateLimit)); err != nil {
			return nil, err
		}
	}
	if kind == "" || kind == storytellerModel.WorkspaceSearchKindAsset {
		if err := appendRows(s.repo.WorkspaceSearchAssets(project.ID, keyword, workspaceSearchCandidateLimit)); err != nil {
			return nil, err
		}
	}
	sort.SliceStable(sources, func(i, j int) bool {
		if sources[i].Relevance != sources[j].Relevance {
			return sources[i].Relevance < sources[j].Relevance
		}
		return sources[i].UpdatedAt.After(sources[j].UpdatedAt)
	})
	if len(sources) > workspaceSearchResultLimit {
		sources = sources[:workspaceSearchResultLimit]
	}

	results := make([]storytellerModel.WorkspaceSearchResult, 0, len(sources))
	for _, source := range sources {
		content := workspaceSearchPlainText(source)
		results = append(results, storytellerModel.WorkspaceSearchResult{
			Kind:               source.Kind,
			PublicID:           source.PublicID,
			ContentType:        source.ContentType,
			Title:              source.Title,
			Context:            workspaceSearchExcerpt(content, keyword, 84),
			Preview:            workspaceSearchExcerpt(content, keyword, 220),
			Location:           workspaceSearchLocation(source),
			CollectionPublicID: source.CollectionPublicID,
			UpdatedAt:          source.UpdatedAt,
		})
	}
	return results, nil
}

func workspaceSearchPlainText(source storytellerModel.WorkspaceSearchSource) string {
	content := ""
	switch source.Kind {
	case storytellerModel.WorkspaceSearchKindStory:
		if source.ContentType == storytellerModel.ProjectContentTypeImage {
			imageContent, _, err := storyIndexContent(&storytellerModel.Story{ContentType: source.ContentType, LatestContent: source.Content})
			if err == nil {
				content = imageContent
			}
		} else {
			content = plainTextFromStoryContent(source.Content)
		}
	case storytellerModel.WorkspaceSearchKindLore:
		content = plainTextFromStoryContent(source.Content)
	default:
		content = source.Content
	}
	return workspaceSearchStripMarkdown(strings.Join([]string{source.Summary, content}, "\n"))
}

// workspaceSearchStripMarkdown 只清掉 Preview 不該顯示的常見 Markdown 記號；正文仍
// 保留，讓 code block 內的實際內容可以被搜尋，不在這裡改動公開搜尋索引的既有行為。
func workspaceSearchStripMarkdown(text string) string {
	text = workspaceSearchCodeFenceRegexp.ReplaceAllString(text, "")
	text = workspaceSearchHeadingRegexp.ReplaceAllString(text, "")
	lines := strings.Split(text, "\n")
	for i := range lines {
		lines[i] = workspaceSearchStripInlineDelimiters(lines[i])
	}
	return strings.TrimSpace(strings.Join(lines, "\n"))
}

// workspaceSearchStripInlineDelimiters 對齊前端 parseInline：只有找到相同收尾的 delimiter
// 才移除記號；孤立的 ++、--、~、^、*、` 都保留為正文，避免 C++ 等字面內容被吃掉。
func workspaceSearchStripInlineDelimiters(text string) string {
	openIndex, delimiter := -1, ""
	for i := 0; i < len(text); i++ {
		for _, candidate := range workspaceSearchInlineDelimiters {
			if strings.HasPrefix(text[i:], candidate) {
				openIndex, delimiter = i, candidate
				break
			}
		}
		if openIndex >= 0 {
			break
		}
	}
	if openIndex < 0 {
		return text
	}
	contentStart := openIndex + len(delimiter)
	closingOffset := strings.Index(text[contentStart:], delimiter)
	if closingOffset < 0 {
		return text[:contentStart] + workspaceSearchStripInlineDelimiters(text[contentStart:])
	}
	closeIndex := contentStart + closingOffset
	inner := text[contentStart:closeIndex]
	if delimiter != "`" {
		inner = workspaceSearchStripInlineDelimiters(inner)
	}
	return text[:openIndex] + inner + workspaceSearchStripInlineDelimiters(text[closeIndex+len(delimiter):])
}

func workspaceSearchSourceMatches(source storytellerModel.WorkspaceSearchSource, keyword string) bool {
	return workspaceSearchFoldedRuneIndex(strings.Join([]string{source.Title, workspaceSearchPlainText(source)}, "\n"), keyword) >= 0
}

// workspaceSearchFoldedRuneIndex 回傳 rune index，避免 Unicode 大小寫轉換改變 byte 長度
// 後再拿 byte index 回切原文；找不到時回傳 -1。
func workspaceSearchFoldedRuneIndex(text, keyword string) int {
	haystack, needle := []rune(text), []rune(keyword)
	if len(needle) == 0 {
		return 0
	}
	if len(needle) > len(haystack) {
		return -1
	}
	for i := range haystack[:len(haystack)-len(needle)+1] {
		matched := true
		for j := range needle {
			if unicode.ToLower(haystack[i+j]) != unicode.ToLower(needle[j]) {
				matched = false
				break
			}
		}
		if matched {
			return i
		}
	}
	return -1
}

func workspaceSearchLocation(source storytellerModel.WorkspaceSearchSource) string {
	collection := source.CollectionName
	if collection == "" {
		if source.Kind == storytellerModel.WorkspaceSearchKindStory {
			collection = "未分冊"
		} else {
			collection = "未分類"
		}
	}
	switch source.Kind {
	case storytellerModel.WorkspaceSearchKindStory:
		return "作品與冊／" + collection
	case storytellerModel.WorkspaceSearchKindLore:
		return "設定集／" + collection
	default:
		return "資產庫／" + collection
	}
}

func workspaceSearchExcerpt(text, keyword string, limit int) string {
	text = whitespaceRegexp.ReplaceAllString(strings.TrimSpace(text), " ")
	if text == "" || limit <= 0 {
		return ""
	}
	runes := []rune(text)
	if len(runes) <= limit {
		return text
	}
	start := 0
	if runeIndex := workspaceSearchFoldedRuneIndex(text, keyword); runeIndex >= 0 {
		start = runeIndex - limit/3
		if start < 0 {
			start = 0
		}
	}
	if start+limit > len(runes) {
		start = len(runes) - limit
	}
	end := start + limit
	prefix, suffix := "", ""
	if start > 0 {
		prefix = "…"
	}
	if end < len(runes) {
		suffix = "…"
	}
	return prefix + string(runes[start:end]) + suffix
}
