package storyteller

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"regexp"
	"strings"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

const (
	// storytellerSearchReplaceBatchLimit 是 batch 版一次最多可帶的取代組數，避免單次呼叫
	// 塞太多 regex 拖垮請求；真的要更多就分批呼叫。
	storytellerSearchReplaceBatchLimit = 50
	// dry_run 時每組規則最多附幾個前後對照，以及對照前後各帶幾個字
	storytellerDryRunSamplesPerRule = 3
	storytellerDryRunSampleContext  = 20
)

// storytellerReplacementArguments 是單一組「搜尋 → 取代」參數；單筆工具直接嵌入，
// batch 工具則是陣列。
type storytellerReplacementArguments struct {
	Search  string `json:"search"`
	Replace string `json:"replace"`
	IsRegex bool   `json:"is_regex"`
}

// storytellerReplacementRule 是編譯好、可直接套用的取代規則。
type storytellerReplacementRule struct {
	Pattern *regexp.Regexp
	Replace string
}

type storytellerSearchReplaceStoryBatchArguments struct {
	ProjectPublicID string                            `json:"project_public_id"`
	StoryPublicID   string                            `json:"story_public_id"`
	Replacements    []storytellerReplacementArguments `json:"replacements"`
	DryRun          bool                              `json:"dry_run"`
}

type storytellerSearchReplaceLoreBatchArguments struct {
	ProjectPublicID string                            `json:"project_public_id"`
	LorePublicID    string                            `json:"lore_public_id"`
	Replacements    []storytellerReplacementArguments `json:"replacements"`
	DryRun          bool                              `json:"dry_run"`
}

type storytellerSearchReplaceOutput struct {
	MatchCount                 int `json:"match_count"`
	TextMatchCount             int `json:"text_match_count"`
	ImageDescriptionMatchCount int `json:"image_description_match_count"`
	AffectedPages              int `json:"affected_pages"`
}

// storytellerSearchReplaceBatchOutput 在總計之外，多回傳每一組取代各自命中幾次（順序同 replacements），
// 讓 client 能看出哪幾組沒命中、要不要重下。
type storytellerSearchReplaceBatchOutput struct {
	storytellerSearchReplaceOutput
	ReplacementMatchCounts []int `json:"replacement_match_counts"`
}

type storytellerStorySearchReplaceOutput struct {
	storytellerStoryDetail
	storytellerSearchReplaceOutput
}

type storytellerLoreSearchReplaceOutput struct {
	storytellerLoreDetail
	storytellerSearchReplaceOutput
}

type storytellerStorySearchReplaceBatchOutput struct {
	storytellerStoryDetail
	storytellerSearchReplaceBatchOutput
}

type storytellerLoreSearchReplaceBatchOutput struct {
	storytellerLoreDetail
	storytellerSearchReplaceBatchOutput
}

// storytellerSearchReplaceDryRunOutput 是 dry_run 的回傳：只有命中數與前後對照，不含全文。
type storytellerSearchReplaceDryRunOutput struct {
	DryRun bool `json:"dry_run"`
	storytellerSearchReplaceBatchOutput
	Samples []storytellerReplacementSample `json:"samples"`
	// VersionID 是試算時用的版本；實際寫入時會拿當下最新版重算
	VersionID uint64 `json:"version_id"`
}

// storytellerReplacementSample 是某組規則的一個命中，在「套到這一組時」的內容狀態下的前後對照。
type storytellerReplacementSample struct {
	ReplacementIndex int    `json:"replacement_index"`
	PageIndex        *int   `json:"page_index,omitempty"`
	Before           string `json:"before"`
	After            string `json:"after"`
}

// storytellerReplaceSampler 在 dry_run 時跟著規則套用流程收集前後對照；nil 代表不是 dry_run。
type storytellerReplaceSampler struct {
	perRule []int
	samples []storytellerReplacementSample
}

func newStorytellerReplaceSampler(dryRun bool, ruleCount int) *storytellerReplaceSampler {
	if !dryRun {
		return nil
	}
	return &storytellerReplaceSampler{perRule: make([]int, ruleCount), samples: []storytellerReplacementSample{}}
}

// collect 在第 ruleIndex 組規則套用前被呼叫，input 是當下的內容；replace 模板用 Expand 展開，
// 跟 ReplaceAllString 的結果一致（含 $1 與 literal 模式跳脫過的 $$）。
func (s *storytellerReplaceSampler) collect(ruleIndex int, rule storytellerReplacementRule, input string, pageIndex *int) {
	remaining := storytellerDryRunSamplesPerRule - s.perRule[ruleIndex]
	if remaining <= 0 {
		return
	}
	for _, m := range rule.Pattern.FindAllStringSubmatchIndex(input, remaining) {
		// 前後文去掉 marker 記號方便閱讀；中間的命中與取代結果維持原文
		before := storytellerReadableBefore(input[:m[0]], storytellerDryRunSampleContext)
		after := storytellerReadableAfter(input[m[1]:], storytellerDryRunSampleContext)
		replaced := string(rule.Pattern.ExpandString(nil, rule.Replace, input, m))
		s.samples = append(s.samples, storytellerReplacementSample{
			ReplacementIndex: ruleIndex,
			PageIndex:        pageIndex,
			Before:           before + input[m[0]:m[1]] + after,
			After:            before + replaced + after,
		})
		s.perRule[ruleIndex]++
	}
}

type storytellerReplaceResult struct {
	Content                    string
	MatchCount                 int
	TextMatchCount             int
	ImageDescriptionMatchCount int
	AffectedPages              int
	// RuleMatchCounts 是每組規則各自的命中數，順序同傳入的 rules
	RuleMatchCounts []int
}

// storytellerSearchReplaceBatchToolSpecs 是只給外部 MCP client 的 batch 取代工具（AI 助理面板
// 沒有對應的提案預覽，所以不掛主 registry）。
func storytellerSearchReplaceBatchToolSpecs() []ToolSpec {
	return []ToolSpec{storytellerSearchReplaceStoryBatchToolSpec(), storytellerSearchReplaceLoreBatchToolSpec()}
}

func storytellerSearchReplaceStoryBatchToolSpec() ToolSpec {
	return ToolSpec{
		Name: "storyteller_search_replace_story_batch",
		Description: "Batch version of storyteller_search_replace_story: apply several search/replace pairs to one existing story in a single call. Writes directly unless dry_run=true. " +
			"Replacements are applied in array order, and each one sees the content produced by the previous ones (so a later search can match text an earlier replace inserted). " +
			"All patterns are validated before anything is applied; if any is invalid, the call fails and nothing is written. " +
			"Every pair follows the same rules as storyteller_search_replace_story (case-sensitive, literal unless is_regex, image stories only touch page descriptions). " +
			"The whole batch is saved as ONE new version; if the total match_count is 0, nothing is written. " +
			"replacement_match_counts reports how many matches each pair had, in the same order as replacements.",
		InputSchema: objectSchema(map[string]interface{}{
			"project_public_id": stringSchema("Project public_id."),
			"story_public_id":   stringSchema("Existing story public_id to edit."),
			"replacements":      storytellerReplacementsSchema(),
			"dry_run":           storytellerDryRunSchema(),
		}, []string{"project_public_id", "story_public_id", "replacements"}),
		Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
			var args storytellerSearchReplaceStoryBatchArguments
			if err := decodeArguments(arguments, &args); err != nil {
				return nil, err
			}
			rules, err := compileStorytellerReplacements(args.Replacements)
			if err != nil {
				return nil, err
			}
			sampler := newStorytellerReplaceSampler(args.DryRun, len(rules))
			detail, result, err := runStorySearchReplace(ctx, args.ProjectPublicID, args.StoryPublicID, rules, sampler)
			if err != nil {
				return nil, err
			}
			if sampler != nil {
				return result.dryRunOutput(sampler, detail.VersionID), nil
			}
			return storytellerStorySearchReplaceBatchOutput{storytellerStoryDetail: detail, storytellerSearchReplaceBatchOutput: result.batchOutput()}, nil
		},
	}
}

func storytellerSearchReplaceLoreBatchToolSpec() ToolSpec {
	return ToolSpec{
		Name: "storyteller_search_replace_lore_batch",
		Description: "Batch version of storyteller_search_replace_lore: apply several search/replace pairs to one existing lore/worldbuilding entry in a single call. Writes directly unless dry_run=true. " +
			"Replacements are applied in array order, and each one sees the content produced by the previous ones. " +
			"All patterns are validated before anything is applied; if any is invalid, the call fails and nothing is written. " +
			"Every pair follows the same rules as storyteller_search_replace_lore (case-sensitive, literal unless is_regex). " +
			"The whole batch is saved as ONE new version; if the total match_count is 0, nothing is written. " +
			"replacement_match_counts reports how many matches each pair had, in the same order as replacements.",
		InputSchema: objectSchema(map[string]interface{}{
			"project_public_id": stringSchema("Project public_id."),
			"lore_public_id":    stringSchema("Existing lore public_id to edit."),
			"replacements":      storytellerReplacementsSchema(),
			"dry_run":           storytellerDryRunSchema(),
		}, []string{"project_public_id", "lore_public_id", "replacements"}),
		Handler: func(ctx context.Context, arguments map[string]interface{}) (interface{}, error) {
			var args storytellerSearchReplaceLoreBatchArguments
			if err := decodeArguments(arguments, &args); err != nil {
				return nil, err
			}
			rules, err := compileStorytellerReplacements(args.Replacements)
			if err != nil {
				return nil, err
			}
			sampler := newStorytellerReplaceSampler(args.DryRun, len(rules))
			detail, result, err := runLoreSearchReplace(ctx, args.ProjectPublicID, args.LorePublicID, rules, sampler)
			if err != nil {
				return nil, err
			}
			if sampler != nil {
				return result.dryRunOutput(sampler, detail.VersionID), nil
			}
			return storytellerLoreSearchReplaceBatchOutput{storytellerLoreDetail: detail, storytellerSearchReplaceBatchOutput: result.batchOutput()}, nil
		},
	}
}

func storytellerDryRunSchema() map[string]interface{} {
	return booleanSchema(fmt.Sprintf("Optional, defaults to false. true computes the result without writing and returns match counts plus up to %d before/after samples per replacement (each taken from the content as it stands when that replacement is applied) and the version_id used. "+
		"A later real call recomputes against the latest version, so compare its match counts with the dry run.", storytellerDryRunSamplesPerRule))
}

func storytellerReplacementsSchema() map[string]interface{} {
	return map[string]interface{}{
		"type":        "array",
		"description": fmt.Sprintf("Required. 1 to %d search/replace pairs, applied in order.", storytellerSearchReplaceBatchLimit),
		"minItems":    1,
		"maxItems":    storytellerSearchReplaceBatchLimit,
		"items": objectSchema(map[string]interface{}{
			"search":   stringSchema("Required search text or RE2 regexp pattern. Case-sensitive unless is_regex=true and you include an inline flag such as (?i). Must not be able to match an empty string."),
			"replace":  stringSchema("Required replacement text. When is_regex=true, Go regexp replacement references such as $1 and ${name} are supported."),
			"is_regex": booleanSchema("Optional, defaults to false. false means literal search; true means compile search as a Go RE2 regexp."),
		}, []string{"search", "replace"}),
	}
}

// runStorySearchReplace 是單筆／batch 共用的寫入流程：讀最新版 → 依序套用 rules →
// 有命中才走 UpdateStory 存成「一個」新版本；沒命中就原樣回傳，不產生版本。
func runStorySearchReplace(ctx context.Context, projectPublicID, storyPublicID string, rules []storytellerReplacementRule, sampler *storytellerReplaceSampler) (storytellerStoryDetail, storytellerReplaceResult, error) {
	userID, err := storytellerUserIDFromContext(ctx)
	if err != nil {
		return storytellerStoryDetail{}, storytellerReplaceResult{}, err
	}
	service := NewService()
	story, err := service.Story(userID, projectPublicID, storyPublicID)
	if err != nil {
		return storytellerStoryDetail{}, storytellerReplaceResult{}, err
	}
	result, err := replaceStoryContentRules(story.ContentType, story.LatestContent, rules, sampler)
	if err != nil {
		return storytellerStoryDetail{}, storytellerReplaceResult{}, err
	}
	// dry_run 只試算不寫入，也不用組完整輸出
	if sampler != nil {
		return storytellerStoryDetail{VersionID: derefUint64(story.LatestVersionID)}, result, nil
	}
	conflicted := false
	if result.MatchCount > 0 {
		input := storytellerModel.StoryRequest{
			Title:         story.Title,
			Summary:       story.Summary,
			Status:        story.Status,
			Sort:          story.Sort,
			Content:       result.Content,
			ContentType:   story.ContentType,
			BaseVersionID: story.LatestVersionID,
		}
		if story, conflicted, err = service.UpdateStory(userID, projectPublicID, storyPublicID, input, storytellerSourceFromContext(ctx)); err != nil {
			return storytellerStoryDetail{}, storytellerReplaceResult{}, err
		}
	}
	detail, err := storytellerStoryDetailForOutput(service, userID, projectPublicID, story, conflicted)
	return detail, result, err
}

// runLoreSearchReplace 同 runStorySearchReplace，設定集只有純文字內容。
func runLoreSearchReplace(ctx context.Context, projectPublicID, lorePublicID string, rules []storytellerReplacementRule, sampler *storytellerReplaceSampler) (storytellerLoreDetail, storytellerReplaceResult, error) {
	userID, err := storytellerUserIDFromContext(ctx)
	if err != nil {
		return storytellerLoreDetail{}, storytellerReplaceResult{}, err
	}
	service := NewService()
	lore, err := service.Lore(userID, projectPublicID, lorePublicID)
	if err != nil {
		return storytellerLoreDetail{}, storytellerReplaceResult{}, err
	}
	result, err := replaceStoryContentRules(storytellerModel.ProjectContentTypeText, lore.LatestContent, rules, sampler)
	if err != nil {
		return storytellerLoreDetail{}, storytellerReplaceResult{}, err
	}
	if sampler != nil {
		return storytellerLoreDetail{VersionID: derefUint64(lore.LatestVersionID)}, result, nil
	}
	conflicted := false
	if result.MatchCount > 0 {
		input := storytellerModel.LoreRequest{Title: lore.Title, Content: result.Content, BaseVersionID: lore.LatestVersionID}
		if lore, conflicted, err = service.UpdateLore(userID, projectPublicID, lorePublicID, input, storytellerSourceFromContext(ctx)); err != nil {
			return storytellerLoreDetail{}, storytellerReplaceResult{}, err
		}
	}
	return storytellerLoreDetail{
		storytellerLoreSummary: toStorytellerLoreSummary(*lore),
		Content:                lore.LatestContent,
		VersionID:              derefUint64(lore.LatestVersionID),
		FormatWarnings:         storyFormatWarningsAfterSave(lore.LatestContent),
		VersionConflict:        conflicted,
	}, result, nil
}

// compile 把單組參數編譯成可套用的規則。
func (a storytellerReplacementArguments) compile() (storytellerReplacementRule, error) {
	pattern, replace, err := compileStorytellerSearchReplace(a.Search, a.Replace, a.IsRegex)
	return storytellerReplacementRule{Pattern: pattern, Replace: replace}, err
}

// compileStorytellerReplacements 先把整批規則都編譯過，任何一組有問題就整批拒絕（錯誤帶上 index），
// 確保不會發生「前半套用了、後半失敗」的半成品寫入。
func compileStorytellerReplacements(items []storytellerReplacementArguments) ([]storytellerReplacementRule, error) {
	if len(items) == 0 {
		return nil, errors.New("replacements must contain at least one item")
	}
	if len(items) > storytellerSearchReplaceBatchLimit {
		return nil, fmt.Errorf("replacements must not exceed %d items", storytellerSearchReplaceBatchLimit)
	}
	rules := make([]storytellerReplacementRule, 0, len(items))
	for i, item := range items {
		rule, err := item.compile()
		if err != nil {
			return nil, fmt.Errorf("replacements[%d]: %w", i, err)
		}
		rules = append(rules, rule)
	}
	return rules, nil
}

// compileStorytellerSearchReplace 編譯 search pattern，並回傳實際要交給 ReplaceAllString 的 replace 模板。
//
// literal 模式（isRegex=false）下 search 用 QuoteMeta 當純文字，replace 也必須是純文字：
// ReplaceAllString 會把 replace 裡的 `$1`、`$name` 展開成群組參照，literal 模式沒有群組，
// 「售價 $100 元」會被默默吃成「售價  元」。這裡把 `$` 跳脫成 `$$`，讓兩邊都名副其實是 literal。
func compileStorytellerSearchReplace(search, replace string, isRegex bool) (*regexp.Regexp, string, error) {
	pattern := search
	if !isRegex {
		pattern = regexp.QuoteMeta(search)
		replace = strings.ReplaceAll(replace, "$", "$$")
	}
	re, err := regexp.Compile(pattern)
	if err != nil {
		return nil, "", fmt.Errorf("invalid search pattern: %w", err)
	}
	// 空字串或能配到零寬度的 regex（例如 "x*"、"a?"、"^"）會讓 FindAllStringIndex/
	// ReplaceAllString 在原內容「每個字元之間」都算命中一次：換行結果是 replace 被插進
	// 每個字元的縫隙，整篇內容膨脹成 replace 複製貼上 N 次、中間夾雜原內容零星單字元碎片
	// （N ≈ 原內容 rune 數）。這裡在編譯階段就擋掉，避免存到毀損內容。
	if re.MatchString("") {
		return nil, "", errors.New("search pattern must not match an empty string (it would insert replace between every character)")
	}
	return re, replace, nil
}

// replaceStoryContent 是單組規則的便捷版本（提案預覽與測試在用）。
func replaceStoryContent(contentType storytellerModel.ProjectContentType, rawContent string, pattern *regexp.Regexp, replace string) (storytellerReplaceResult, error) {
	return replaceStoryContentRules(contentType, rawContent, []storytellerReplacementRule{{Pattern: pattern, Replace: replace}}, nil)
}

// replaceStoryContentRules 依序套用 rules。圖像故事只動每頁 description，不把 pages JSON 當純文字搜尋。
// sampler 非 nil（dry_run）時順便收集前後對照。
func replaceStoryContentRules(contentType storytellerModel.ProjectContentType, rawContent string, rules []storytellerReplacementRule, sampler *storytellerReplaceSampler) (storytellerReplaceResult, error) {
	if contentType == storytellerModel.ProjectContentTypeImage {
		return replaceImageStoryDescriptions(rawContent, rules, sampler)
	}
	result := storytellerReplaceResult{RuleMatchCounts: make([]int, len(rules))}
	result.Content, result.MatchCount = applyReplacementRules(rawContent, rules, result.RuleMatchCounts, sampler, nil)
	result.TextMatchCount = result.MatchCount
	return result, nil
}

// replaceImageStoryDescriptions 對每頁 description 依序套用 rules；affected_pages 算的是
// 「至少被一組規則命中的頁數」，batch 多組命中同一頁也只算一次。
func replaceImageStoryDescriptions(rawContent string, rules []storytellerReplacementRule, sampler *storytellerReplaceSampler) (storytellerReplaceResult, error) {
	var content storytellerModel.StoryImageContent
	if err := json.Unmarshal([]byte(rawContent), &content); err != nil {
		return storytellerReplaceResult{}, fmt.Errorf("invalid image story content: %w", err)
	}
	result := storytellerReplaceResult{RuleMatchCounts: make([]int, len(rules))}
	for i := range content.Pages {
		description, count := applyReplacementRules(content.Pages[i].Description, rules, result.RuleMatchCounts, sampler, &i)
		if count == 0 {
			continue
		}
		content.Pages[i].Description = description
		result.MatchCount += count
		result.ImageDescriptionMatchCount += count
		result.AffectedPages++
	}
	if result.MatchCount == 0 {
		result.Content = rawContent
		return result, nil
	}
	body, err := json.Marshal(content)
	if err != nil {
		return storytellerReplaceResult{}, err
	}
	result.Content = string(body)
	return result, nil
}

// applyReplacementRules 把 rules 依序套在 input 上（後面的規則看得到前面的取代結果），
// 每組命中數累加進 counts（圖像故事會跨頁累加），回傳結果與這次的總命中數。
// pageIndex 只有圖像故事會帶，給 dry_run 對照標示是哪一頁。
func applyReplacementRules(input string, rules []storytellerReplacementRule, counts []int, sampler *storytellerReplaceSampler, pageIndex *int) (string, int) {
	total := 0
	for i, rule := range rules {
		if sampler != nil {
			sampler.collect(i, rule, input, pageIndex)
		}
		var count int
		input, count = replaceAllCounting(rule.Pattern, input, rule.Replace)
		counts[i] += count
		total += count
	}
	return input, total
}

func replaceAllCounting(pattern *regexp.Regexp, input, replace string) (string, int) {
	matches := pattern.FindAllStringIndex(input, -1)
	if len(matches) == 0 {
		return input, 0
	}
	return pattern.ReplaceAllString(input, replace), len(matches)
}

func (r storytellerReplaceResult) output() storytellerSearchReplaceOutput {
	return storytellerSearchReplaceOutput{
		MatchCount:                 r.MatchCount,
		TextMatchCount:             r.TextMatchCount,
		ImageDescriptionMatchCount: r.ImageDescriptionMatchCount,
		AffectedPages:              r.AffectedPages,
	}
}

func (r storytellerReplaceResult) dryRunOutput(sampler *storytellerReplaceSampler, versionID uint64) storytellerSearchReplaceDryRunOutput {
	return storytellerSearchReplaceDryRunOutput{DryRun: true, storytellerSearchReplaceBatchOutput: r.batchOutput(), Samples: sampler.samples, VersionID: versionID}
}

func (r storytellerReplaceResult) batchOutput() storytellerSearchReplaceBatchOutput {
	return storytellerSearchReplaceBatchOutput{storytellerSearchReplaceOutput: r.output(), ReplacementMatchCounts: r.RuleMatchCounts}
}
