package storyteller

import (
	"regexp"
	"strings"
)

// storyHoistableBlockPrefixPattern 是可以從段落 marker 內搬到外面的引用／清單前綴。
// 分隔線 `---`、表格 `|` 不在此列：它們不是「前綴＋文字」的段落，包在 marker 裡就只是字面文字。
var storyHoistableBlockPrefixPattern = regexp.MustCompile(`^(?:> |- |\d+\. )`)

// hoistStoryMarkerBlockPrefixes 把誤包進段落 marker 內的標題／引用／清單前綴搬到 marker 外面：
// `⟦id⟧# 第一幕⟦/id⟧` → `# ⟦id⟧第一幕⟦/id⟧`。
//
// 前端 parser 與 serializer 的格式是「行首前綴在 marker 外」，marker 內的 `# ` 只會被當成字面文字，
// 閱讀頁/編輯頁都不會 render 成標題。MCP client（AI agent）照工具說明「標題也要包 marker」字面理解，
// 常把前綴一起包進去，所以在存檔關卡統一修正。
//
// 只套用在非網頁來源（source 不是 `web_*`）：serializer 不做 escape，網頁編輯器存出的
// `⟦id⟧- foo⟦/id⟧` 代表使用者真的打了字面上的 `- foo`（例如貼上純文字），不能擅自轉成清單。
func hoistStoryMarkerBlockPrefixes(content, source string) string {
	if strings.HasPrefix(source, "web_") {
		return content
	}
	lines := strings.Split(content, "\n")
	changed := false
	walkStoryContentLines(lines, func(i int, line string) {
		// 已經有外層前綴的行照舊，不處理兩層前綴這種不合法組合
		if _, prefixEnd := storyHeadingPrefix(line); prefixEnd > 0 || blockKindPrefixPattern.MatchString(line) {
			return
		}
		match := storyMarkerPattern.FindStringSubmatch(line)
		if match == nil || match[1] != match[3] || match[1] == "" {
			return
		}
		inner := match[2]
		prefix := storyHoistableBlockPrefixPattern.FindString(inner)
		if _, end := storyHeadingPrefix(inner); end > 0 {
			prefix = inner[:end]
		}
		if prefix == "" {
			return
		}
		// 開頭 marker 的結尾位置用「整行 - 結尾 marker - 內文」反推，避免屬性值裡含 `⟧` 時算錯
		openEnd := len(line) - len("⟦/"+match[3]+"⟧") - len(inner)
		lines[i] = prefix + line[:openEnd] + line[openEnd+len(prefix):]
		changed = true
	})
	if !changed {
		return content
	}
	return strings.Join(lines, "\n")
}
