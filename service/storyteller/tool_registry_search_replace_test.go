package storyteller

import (
	"encoding/json"
	"regexp"
	"strings"
	"testing"

	storytellerModel "faryne.dev/model/entity/storyteller"
	"github.com/stretchr/testify/require"
)

func TestCompileStorytellerSearchPatternEscapesLiteralSearch(t *testing.T) {
	pattern, err := compileStorytellerSearchPattern("Lux.Oris?", false)
	require.NoError(t, err)

	replaced, count := replaceAllCounting(pattern, "Lux.Oris? LuxxOris?", "LUXORIS")

	require.Equal(t, 1, count)
	require.Equal(t, "LUXORIS LuxxOris?", replaced)
}

func TestCompileStorytellerSearchPatternReturnsRegexError(t *testing.T) {
	_, err := compileStorytellerSearchPattern("(", true)
	require.Error(t, err)
	require.Contains(t, err.Error(), "invalid search pattern")
	require.Contains(t, err.Error(), "missing closing")
}

func TestReplaceStoryContentTextSupportsRegexCaptureReferences(t *testing.T) {
	pattern, err := compileStorytellerSearchPattern(`Lux(Oris)`, true)
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
	pattern, err := compileStorytellerSearchPattern("LuxOris", false)
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
	pattern, err := compileStorytellerSearchPattern("LuxOris", false)
	require.NoError(t, err)

	result, err := replaceStoryContent(storytellerModel.ProjectContentTypeImage, rawContent, pattern, "LUXORIS")

	require.NoError(t, err)
	require.Equal(t, rawContent, result.Content)
	require.Equal(t, 0, result.MatchCount)
	require.Equal(t, 0, result.AffectedPages)
}

// TestCompileStorytellerSearchPatternRejectsEmptyLiteralSearch 涵蓋真正造成故事內容炸開的
// 那個 bug：search 是空字串時，regexp.QuoteMeta("") 還是空字串，編譯出來的 pattern 會在
// 「每個字元之間」都算命中一次。ReplaceAllString 對 N 個 rune 的內容會插入 N+1 次 replace，
// 產生 replace 複製貼上 N+1 次、中間夾雜原內容零星單字元碎片的結果——跟現場回報的壞掉內容
// 一模一樣。必須在編譯階段就擋掉，不能讓它走到實際 replace。
func TestCompileStorytellerSearchPatternRejectsEmptyLiteralSearch(t *testing.T) {
	_, err := compileStorytellerSearchPattern("", false)
	require.Error(t, err)
	require.Contains(t, err.Error(), "must not match an empty string")
}

// TestCompileStorytellerSearchPatternRejectsZeroWidthRegex 涵蓋 is_regex=true 時，regexp
// pattern 本身可以配到零寬度字串的情況（例如 "x*"、"a?"），效果跟空字串 search 完全一樣。
func TestCompileStorytellerSearchPatternRejectsZeroWidthRegex(t *testing.T) {
	_, err := compileStorytellerSearchPattern("x*", true)
	require.Error(t, err)
	require.Contains(t, err.Error(), "must not match an empty string")
}

// TestReplaceAllCountingWithoutGuardCorruptsContent 直接示範被擋下來的那個 bug 長什麼樣子：
// 繞過 compileStorytellerSearchPattern 的防呆，手動組一個空字串 pattern 餵給
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
	pattern, err := compileStorytellerSearchPattern(find, false)
	require.NoError(t, err)

	content := "前段。" + find + ")。中段。" + find + ")。後段。" + find + ")。結尾。"

	result, err := replaceStoryContent(storytellerModel.ProjectContentTypeText, content, pattern, replace)
	require.NoError(t, err)

	require.Equal(t, 3, result.MatchCount)
	require.Equal(t, 3, strings.Count(result.Content, replace))
	expected := "前段。" + replace + ")。中段。" + replace + ")。後段。" + replace + ")。結尾。"
	require.Equal(t, expected, result.Content)
}
