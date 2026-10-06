package storyteller

import (
	"encoding/json"
	"regexp"
	"strings"
	"testing"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"github.com/stretchr/testify/require"
)

func TestCompileStorytellerSearchReplaceEscapesLiteralSearch(t *testing.T) {
	pattern, _, err := compileStorytellerSearchReplace("Lux.Oris?", "", false)
	require.NoError(t, err)

	replaced, count := replaceAllCounting(pattern, "Lux.Oris? LuxxOris?", "LUXORIS")

	require.Equal(t, 1, count)
	require.Equal(t, "LUXORIS LuxxOris?", replaced)
}

// literal 模式下 replace 也是純文字：`$100` 不能被 ReplaceAllString 當成群組參照吃掉（2026-10-04 修正）。
func TestCompileStorytellerSearchReplaceKeepsDollarInLiteralReplace(t *testing.T) {
	pattern, replace, err := compileStorytellerSearchReplace("價格", "售價 $100 元（${name}）", false)
	require.NoError(t, err)

	result, err := replaceStoryContent(storytellerModel.ProjectContentTypeText, "價格未定", pattern, replace)

	require.NoError(t, err)
	require.Equal(t, "售價 $100 元（${name}）未定", result.Content)
}

func TestCompileStorytellerSearchReplaceReturnsRegexError(t *testing.T) {
	_, _, err := compileStorytellerSearchReplace("(", "", true)
	require.Error(t, err)
	require.Contains(t, err.Error(), "invalid search pattern")
	require.Contains(t, err.Error(), "missing closing")
}

func TestReplaceStoryContentTextSupportsRegexCaptureReferences(t *testing.T) {
	pattern, _, err := compileStorytellerSearchReplace(`Lux(Oris)`, "", true)
	require.NoError(t, err)

	result, err := replaceStoryContent(storytellerModel.ProjectContentTypeText, "LuxOris / LuxOris", pattern, "LUX$1")

	require.NoError(t, err)
	require.Equal(t, "LUXOris / LUXOris", result.Content)
	require.Equal(t, 2, result.MatchCount)
	require.Equal(t, 2, result.TextMatchCount)
	require.Equal(t, 0, result.ImageDescriptionMatchCount)
	require.Equal(t, 0, result.AffectedPages)
}

func TestReplaceStoryContentImageOnlyChangesPageDescriptions(t *testing.T) {
	rawContent := `{"pages":[{"id":"LuxOris","key":"LuxOris/key.png","asset_public_id":"asset-1","description":"LuxOris 第一頁 LuxOris","sort":0},{"id":"page-2","key":"keep/key.png","description":"沒有命中","sort":1}]}`
	pattern, _, err := compileStorytellerSearchReplace("LuxOris", "", false)
	require.NoError(t, err)

	result, err := replaceStoryContent(storytellerModel.ProjectContentTypeImage, rawContent, pattern, "LUXORIS")
	require.NoError(t, err)

	var content storytellerModel.StoryImageContent
	require.NoError(t, json.Unmarshal([]byte(result.Content), &content))
	require.Equal(t, "LuxOris", content.Pages[0].ID)
	require.Equal(t, "LuxOris/key.png", content.Pages[0].Key)
	require.Equal(t, "LUXORIS 第一頁 LUXORIS", content.Pages[0].Description)
	require.Equal(t, "沒有命中", content.Pages[1].Description)
	require.Equal(t, 2, result.MatchCount)
	require.Equal(t, 0, result.TextMatchCount)
	require.Equal(t, 2, result.ImageDescriptionMatchCount)
	require.Equal(t, 1, result.AffectedPages)
}

func TestReplaceStoryContentImageNoMatchKeepsRawContent(t *testing.T) {
	rawContent := `{"pages":[{"id":"page-1","key":"k.png","description":"沒有命中","sort":0}]}`
	pattern, _, err := compileStorytellerSearchReplace("LuxOris", "", false)
	require.NoError(t, err)

	result, err := replaceStoryContent(storytellerModel.ProjectContentTypeImage, rawContent, pattern, "LUXORIS")

	require.NoError(t, err)
	require.Equal(t, rawContent, result.Content)
	require.Equal(t, 0, result.MatchCount)
	require.Equal(t, 0, result.AffectedPages)
}

// TestCompileStorytellerSearchReplaceRejectsEmptyLiteralSearch 涵蓋真正造成故事內容炸開的
// 那個 bug：search 是空字串時，regexp.QuoteMeta("") 還是空字串，編譯出來的 pattern 會在
// 「每個字元之間」都算命中一次。ReplaceAllString 對 N 個 rune 的內容會插入 N+1 次 replace，
// 產生 replace 複製貼上 N+1 次、中間夾雜原內容零星單字元碎片的結果——跟現場回報的壞掉內容
// 一模一樣。必須在編譯階段就擋掉，不能讓它走到實際 replace。
func TestCompileStorytellerSearchReplaceRejectsEmptyLiteralSearch(t *testing.T) {
	_, _, err := compileStorytellerSearchReplace("", "", false)
	require.Error(t, err)
	require.Contains(t, err.Error(), "must not match an empty string")
}

// TestCompileStorytellerSearchReplaceRejectsZeroWidthRegex 涵蓋 is_regex=true 時，regexp
// pattern 本身可以配到零寬度字串的情況（例如 "x*"、"a?"），效果跟空字串 search 完全一樣。
func TestCompileStorytellerSearchReplaceRejectsZeroWidthRegex(t *testing.T) {
	_, _, err := compileStorytellerSearchReplace("x*", "", true)
	require.Error(t, err)
	require.Contains(t, err.Error(), "must not match an empty string")
}

// TestReplaceAllCountingWithoutGuardCorruptsContent 直接示範被擋下來的那個 bug 長什麼樣子：
// 繞過 compileStorytellerSearchReplace 的防呆，手動組一個空字串 pattern 餵給
// replaceAllCounting，確認結果正是「replace 複製貼上 N 次、中間夾雜單字元碎片」，
// 印證這就是現場看到的壞掉內容從何而來。
func TestReplaceAllCountingWithoutGuardCorruptsContent(t *testing.T) {
	pattern := regexp.MustCompile(regexp.QuoteMeta(""))
	content := "info"
	replaced, count := replaceAllCounting(pattern, content, "X")

	require.Equal(t, 5, count) // len(content)+1 個零寬度插入點
	require.Equal(t, "XiXnXfXoX", replaced)
}

// TestReplaceStoryContentPrefixReplaceAppliesExactlyOncePerOccurrence 驗證使用者原始懷疑的
// 那個情境——find 剛好是 replace 的前綴（例如 `![alt](url` 對到 `![alt](url "attr")`）——
// 單次呼叫只會把「原內容裡真正出現的次數」各自替換一次，不會因為 replace 內含 find 而被
// FindAllStringIndex/ReplaceAllString 在同一次呼叫裡重新配對到自己剛插入的內容：Go 的
// regexp.ReplaceAllString 只掃過一次「原始」字串來決定所有配對位置，插入的 replace 內容
// 本身不會被拿去重新掃描。這裡用同一個 find 出現三次的內容驗證輸出長度跟次數都精準對得上。
func TestReplaceStoryContentPrefixReplaceAppliesExactlyOncePerOccurrence(t *testing.T) {
	find := `![alt](steamloom-asset://xxx`
	replace := `![alt](steamloom-asset://xxx "layout=float-left size=medium")`
	pattern, _, err := compileStorytellerSearchReplace(find, "", false)
	require.NoError(t, err)

	content := "前段。" + find + ")。中段。" + find + ")。後段。" + find + ")。結尾。"

	result, err := replaceStoryContent(storytellerModel.ProjectContentTypeText, content, pattern, replace)
	require.NoError(t, err)

	require.Equal(t, 3, result.MatchCount)
	require.Equal(t, 3, strings.Count(result.Content, replace))
	expected := "前段。" + replace + ")。中段。" + replace + ")。後段。" + replace + ")。結尾。"
	require.Equal(t, expected, result.Content)
}

// batch 取代依序套用：後面的規則看得到前面的取代結果，且每組命中數分開回報。
func TestReplaceStoryContentRulesAppliesInOrder(t *testing.T) {
	rules, err := compileStorytellerReplacements([]storytellerReplacementArguments{
		{Search: "貓", Replace: "狗"},
		{Search: "狗狗", Replace: "柴犬"},
		{Search: "不存在", Replace: "x"},
	})
	require.NoError(t, err)

	result, err := replaceStoryContentRules(storytellerModel.ProjectContentTypeText, "貓狗、貓", rules, nil)

	require.NoError(t, err)
	require.Equal(t, "柴犬、狗", result.Content)
	require.Equal(t, []int{2, 1, 0}, result.RuleMatchCounts)
	require.Equal(t, 3, result.MatchCount)
	require.Equal(t, 3, result.TextMatchCount)
}

// 任何一組 pattern 不合法就整批拒絕，錯誤訊息要帶 index 讓 client 知道是哪一組。
func TestCompileStorytellerReplacementsRejectsWholeBatchWithIndex(t *testing.T) {
	_, err := compileStorytellerReplacements([]storytellerReplacementArguments{
		{Search: "ok", Replace: "x"},
		{Search: "(", Replace: "x", IsRegex: true},
	})
	require.Error(t, err)
	require.Contains(t, err.Error(), "replacements[1]")
	require.Contains(t, err.Error(), "invalid search pattern")

	_, err = compileStorytellerReplacements(nil)
	require.ErrorContains(t, err, "at least one")

	_, err = compileStorytellerReplacements(make([]storytellerReplacementArguments, storytellerSearchReplaceBatchLimit+1))
	require.ErrorContains(t, err, "must not exceed")
}

// 圖像故事多組規則命中同一頁時，affected_pages 只算一次。
func TestReplaceStoryContentRulesImageCountsAffectedPagesOnce(t *testing.T) {
	rawContent := `{"pages":[{"id":"p1","key":"a.png","description":"甲乙","sort":0},{"id":"p2","key":"b.png","description":"丙","sort":1}]}`
	rules, err := compileStorytellerReplacements([]storytellerReplacementArguments{
		{Search: "甲", Replace: "A"},
		{Search: "乙", Replace: "B"},
	})
	require.NoError(t, err)

	result, err := replaceStoryContentRules(storytellerModel.ProjectContentTypeImage, rawContent, rules, nil)

	require.NoError(t, err)
	var content storytellerModel.StoryImageContent
	require.NoError(t, json.Unmarshal([]byte(result.Content), &content))
	require.Equal(t, "AB", content.Pages[0].Description)
	require.Equal(t, "丙", content.Pages[1].Description)
	require.Equal(t, []int{1, 1}, result.RuleMatchCounts)
	require.Equal(t, 2, result.ImageDescriptionMatchCount)
	require.Equal(t, 1, result.AffectedPages)
}

// dry_run 對照取的是「套到這一組時」的內容，regex 的 $1 要展開，每組最多 storytellerDryRunSamplesPerRule 筆。
func TestReplaceSamplerCollectsSamplesPerRuleState(t *testing.T) {
	rules, err := compileStorytellerReplacements([]storytellerReplacementArguments{
		{Search: "貓", Replace: "狗"},
		{Search: `狗(.)`, Replace: "柴犬$1", IsRegex: true},
	})
	require.NoError(t, err)
	sampler := newStorytellerReplaceSampler(true, len(rules))

	result, err := replaceStoryContentRules(storytellerModel.ProjectContentTypeText, "貓A貓B貓C貓D", rules, sampler)

	require.NoError(t, err)
	require.Equal(t, "柴犬A柴犬B柴犬C柴犬D", result.Content)
	require.Equal(t, []int{4, 4}, result.RuleMatchCounts)
	require.Len(t, sampler.samples, 2*storytellerDryRunSamplesPerRule)
	require.Equal(t, storytellerReplacementSample{ReplacementIndex: 0, Before: "貓A貓B貓C貓D", After: "狗A貓B貓C貓D"}, sampler.samples[0])
	require.Equal(t, storytellerReplacementSample{ReplacementIndex: 1, Before: "狗A狗B狗C狗D", After: "柴犬A狗B狗C狗D"}, sampler.samples[3])
	require.Nil(t, newStorytellerReplaceSampler(false, 2))
}
