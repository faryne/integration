package storyteller

import (
	"context"
	"encoding/json"
	"fmt"
	"regexp"
	"sort"
	"unicode/utf8"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

const (
	storytellerSearchProjectDefaultContext = 40
	storytellerSearchProjectMaxContext     = 200
	storytellerSearchProjectDefaultHits    = 100
	storytellerSearchProjectMaxHits        = 500
	// storytellerSearchProjectMaxMatchRunes 限制單一命中回傳的長度，避免 `(?s).+` 這種 pattern 把整篇塞進回應
	storytellerSearchProjectMaxMatchRunes = 200
)

var (
	// 前後文只是給人看的，去掉所有 ⟦…⟧ 記號（段落／行內 marker）免得吃掉字數；
	// 原文視窗邊緣被切到一半的 marker 另外處理
	storytellerAnyMarkerPattern      = regexp.MustCompile(`⟦/?[^⟦⟧\s]+(?: [A-Za-z]+="(?:[^"\\]|\\.)*")*⟧`)
	storytellerLeadingPartialMarker  = regexp.MustCompile(`^[^⟦⟧]*⟧`)
	storytellerTrailingPartialMarker = regexp.MustCompile(`⟦[^⟦⟧]*$`)
)

type storytellerSearchProjectArguments struct {
	ProjectPublicID string `json:"project_public_id"`
	Search          string `json:"search"`
	IsRegex         bool   `json:"is_regex"`
	Scope           string `json:"scope"`
	ContextChars    int    `json:"context_chars"`
	MaxHits         int    `json:"max_hits"`
}

type storytellerSearchProjectOutput struct {
	// TotalMatchCount 是真正的總命中數，就算 hits 因 max_hits 被截斷也照實算
	TotalMatchCount int                       `json:"total_match_count"`
	Truncated       bool                      `json:"truncated"`
	Targets         []storytellerSearchTarget `json:"targets"`
}

// storytellerSearchTarget 是一篇有命中的故事或設定集；截斷後 hits 可能是空的，但 match_count 仍正確。
type storytellerSearchTarget struct {
	Type        string                 `json:"type"`
	PublicID    string                 `json:"public_id"`
	Title       string                 `json:"title"`
	ContentType string                 `json:"content_type,omitempty"`
	VersionID   uint64                 `json:"version_id"`
	MatchCount  int                    `json:"match_count"`
	Hits        []storytellerSearchHit `json:"hits"`
}

// storytellerSearchHit：文字內容給章節 marker_id／標題與行號（1 起算）；圖像故事給 page_index（0 起算）。
type storytellerSearchHit struct {
	MarkerID     string `json:"marker_id,omitempty"`
	ChapterTitle string `json:"chapter_title,omitempty"`
	Line         int    `json:"line,omitempty"`
	PageIndex    *int   `json:"page_index,omitempty"`
	Before       string `json:"before"`
	Match        string `json:"match"`
	After        string `json:"after"`
}

func storytellerSearchProjectToolSpecs() []ToolSpec {
	return []ToolSpec{{
		Name: "storyteller_search_project",
		Description: "Read-only search across every story and lore entry in one project (latest versions; volumes and deleted items are excluded). " +
			"Uses exactly the same matching rules as storyteller_search_replace_story/lore (case-sensitive, literal unless is_regex, Go RE2 syntax, must not match an empty string), " +
			"so the hits found here are exactly what a search/replace with the same search string would change. " +
			"match is the raw matched text; before/after are readable context with ⟦…⟧ marker syntax removed, so do not build a search string by gluing them to match. " +
			"For text content each hit reports the chapter marker_id/title and 1-based line; for image stories only page descriptions are searched and hits report page_index. " +
			"Typical use: find every place a name or term appears, then run storyteller_search_replace_story_batch / _lore_batch on each target (dry_run first). " +
			"total_match_count is always the full count; hits stop at max_hits and truncated becomes true.",
		InputSchema: objectSchema(map[string]interface{}{
			"project_public_id": stringSchema("Project public_id."),
			"search":            stringSchema("Required search text or RE2 regexp pattern. Case-sensitive unless is_regex=true and you include an inline flag such as (?i). Must not be able to match an empty string."),
			"is_regex":          booleanSchema("Optional, defaults to false. false means literal search; true means compile search as a Go RE2 regexp."),
			"scope":             enumStringSchema("Optional, defaults to all.", "all", "stories", "lores"),
			"context_chars":     integerSchema(fmt.Sprintf("Optional. Characters of context before/after each hit, defaults to %d, capped at %d.", storytellerSearchProjectDefaultContext, storytellerSearchProjectMaxContext)),
			"max_hits":          integerSchema(fmt.Sprintf("Optional. Maximum hits returned across the whole project, defaults to %d, capped at %d.", storytellerSearchProjectDefaultHits, storytellerSearchProjectMaxHits)),
		}, []string{"project_public_id", "search"}),
		Handler: searchStorytellerProject,
	}}
}

func searchStorytellerProject(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
	userID, err := storytellerUserIDFromContext(ctx)
	if err != nil {
		return nil, err
	}
	var args storytellerSearchProjectArguments
	if err := decodeArguments(arguments, &args); err != nil {
		return nil, err
	}
	// 共用取代工具的編譯邏輯，確保「搜得到」＝「取代得到」
	pattern, _, err := compileStorytellerSearchReplace(args.Search, "", args.IsRegex)
	if err != nil {
		return nil, err
	}
	if args.Scope != "" && args.Scope != "all" && args.Scope != "stories" && args.Scope != "lores" {
		return nil, fmt.Errorf("invalid scope %q: must be all, stories or lores", args.Scope)
	}
	searcher := storytellerProjectSearcher{
		pattern:      pattern,
		contextChars: clampInt(args.ContextChars, storytellerSearchProjectDefaultContext, storytellerSearchProjectMaxContext),
		maxHits:      clampInt(args.MaxHits, storytellerSearchProjectDefaultHits, storytellerSearchProjectMaxHits),
		output:       storytellerSearchProjectOutput{Targets: []storytellerSearchTarget{}},
	}
	service := NewService()
	if args.Scope != "lores" {
		stories, err := service.Stories(userID, args.ProjectPublicID)
		if err != nil {
			return nil, err
		}
		for _, story := range stories {
			target := storytellerSearchTarget{Type: "story", PublicID: story.PublicID, Title: story.Title, ContentType: string(story.ContentType), VersionID: derefUint64(story.LatestVersionID)}
			if story.ContentType == storytellerModel.ProjectContentTypeImage {
				searcher.searchImageStory(target, story.LatestContent)
			} else {
				searcher.searchText(target, story.LatestContent)
			}
		}
	}
	if args.Scope != "stories" {
		lores, err := service.Lores(userID, args.ProjectPublicID)
		if err != nil {
			return nil, err
		}
		for _, lore := range lores {
			searcher.searchText(storytellerSearchTarget{Type: "lore", PublicID: lore.PublicID, Title: lore.Title, VersionID: derefUint64(lore.LatestVersionID)}, lore.LatestContent)
		}
	}
	return searcher.output, nil
}

// storytellerProjectSearcher 逐篇累積命中；hits 數量是整個專案共用一個上限。
type storytellerProjectSearcher struct {
	pattern      *regexp.Regexp
	contextChars int
	maxHits      int
	hitCount     int
	output       storytellerSearchProjectOutput
}

func (s *storytellerProjectSearcher) searchText(target storytellerSearchTarget, content string) {
	matches := s.pattern.FindAllStringIndex(content, -1)
	if len(matches) == 0 {
		return
	}
	spans := storyChapterSpans(content)
	lineStarts := storytellerLineStarts(content)
	target.Hits = []storytellerSearchHit{}
	for _, m := range matches {
		if !s.takeHit() {
			break
		}
		// sort.Search 找出 offset 所在行（0 起算），再對應到包含該行的章節
		line := sort.Search(len(lineStarts), func(i int) bool { return lineStarts[i] > m[0] }) - 1
		hit := s.hit(content, m)
		hit.Line = line + 1
		for _, span := range spans {
			if line >= span.StartLine && line < span.EndLine {
				hit.MarkerID, hit.ChapterTitle = span.MarkerID, span.Title
				break
			}
		}
		target.Hits = append(target.Hits, hit)
	}
	s.addTarget(target, len(matches))
}

// searchImageStory 只搜每頁 description，跟取代工具一樣不把 pages JSON 當純文字。解析失敗的就跳過。
func (s *storytellerProjectSearcher) searchImageStory(target storytellerSearchTarget, rawContent string) {
	var content storytellerModel.StoryImageContent
	if json.Unmarshal([]byte(rawContent), &content) != nil {
		return
	}
	target.Hits = []storytellerSearchHit{}
	total := 0
	for i, page := range content.Pages {
		matches := s.pattern.FindAllStringIndex(page.Description, -1)
		total += len(matches)
		for _, m := range matches {
			if !s.takeHit() {
				break
			}
			hit := s.hit(page.Description, m)
			hit.PageIndex = &i
			target.Hits = append(target.Hits, hit)
		}
	}
	if total > 0 {
		s.addTarget(target, total)
	}
}

// takeHit 回報這次命中還能不能放進回應；超過上限就標記截斷。
func (s *storytellerProjectSearcher) takeHit() bool {
	if s.hitCount >= s.maxHits {
		s.output.Truncated = true
		return false
	}
	s.hitCount++
	return true
}

func (s *storytellerProjectSearcher) addTarget(target storytellerSearchTarget, matchCount int) {
	target.MatchCount = matchCount
	s.output.TotalMatchCount += matchCount
	s.output.Targets = append(s.output.Targets, target)
}

func (s *storytellerProjectSearcher) hit(content string, m []int) storytellerSearchHit {
	match := content[m[0]:m[1]]
	if utf8.RuneCountInString(match) > storytellerSearchProjectMaxMatchRunes {
		match = storytellerFirstRunes(match, storytellerSearchProjectMaxMatchRunes) + "…"
	}
	return storytellerSearchHit{
		Before: storytellerReadableBefore(content[:m[0]], s.contextChars),
		Match:  match,
		After:  storytellerReadableAfter(content[m[1]:], s.contextChars),
	}
}

// storytellerReadableBefore／storytellerReadableAfter 取命中處前／後 n 個「可讀」字：先多拿一段原文，
// 去掉 marker 記號再裁切。視窗被截斷時，邊緣可能剩半個 marker，要先清掉。
func storytellerReadableBefore(raw string, n int) string {
	window := storytellerLastRunes(raw, n*4+64)
	if len(window) < len(raw) {
		window = storytellerLeadingPartialMarker.ReplaceAllString(window, "")
	}
	return storytellerLastRunes(storytellerAnyMarkerPattern.ReplaceAllString(window, ""), n)
}

func storytellerReadableAfter(raw string, n int) string {
	window := storytellerFirstRunes(raw, n*4+64)
	if len(window) < len(raw) {
		window = storytellerTrailingPartialMarker.ReplaceAllString(window, "")
	}
	return storytellerFirstRunes(storytellerAnyMarkerPattern.ReplaceAllString(window, ""), n)
}

// storytellerLineStarts 回傳每一行開頭的 byte offset。
func storytellerLineStarts(content string) []int {
	starts := []int{0}
	for i := 0; i < len(content); i++ {
		if content[i] == '\n' {
			starts = append(starts, i+1)
		}
	}
	return starts
}

// storytellerFirstRunes／storytellerLastRunes 以 rune 為單位切字串，中文不會被切成亂碼。
func storytellerFirstRunes(s string, n int) string {
	i := 0
	for c := 0; c < n && i < len(s); c++ {
		_, size := utf8.DecodeRuneInString(s[i:])
		i += size
	}
	return s[:i]
}

func storytellerLastRunes(s string, n int) string {
	i := len(s)
	for c := 0; c < n && i > 0; c++ {
		_, size := utf8.DecodeLastRuneInString(s[:i])
		i -= size
	}
	return s[i:]
}

// clampInt：<=0 用預設值，超過上限就壓到上限。
func clampInt(value, fallback, max int) int {
	if value <= 0 {
		return fallback
	}
	return min(value, max)
}
