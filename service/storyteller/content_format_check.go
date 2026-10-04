package storyteller

import (
	"fmt"
	"regexp"
	"strings"

	storytellerModel "faryne.dev/model/entity/storyteller"
)

// storyFormatWarning 是一筆格式問題。Severity：
//   - error：閱讀頁會顯示錯（符號外露、腳注失效、書籤對不到），計入 report.OK
//   - info：啟發式檢查，可能誤報（例如內文真的需要單獨一個 `**`），不計入 report.OK
type storyFormatWarning struct {
	Line            int    `json:"line"`
	Code            string `json:"code"`
	Severity        string `json:"severity"`
	Message         string `json:"message"`
	AutoFixedOnSave bool   `json:"auto_fixed_on_save,omitempty"`
	Suggestion      string `json:"suggestion,omitempty"`
}

type storyFormatChapter struct {
	Level    int    `json:"level"`
	Title    string `json:"title"`
	MarkerID string `json:"marker_id"`
}

type storyFormatSummary struct {
	Paragraphs int  `json:"paragraphs"`
	Chapters   int  `json:"chapters"`
	WordCount  uint `json:"word_count"`
}

type storyFormatReport struct {
	OK               bool                 `json:"ok"`
	Summary          storyFormatSummary   `json:"summary"`
	Chapters         []storyFormatChapter `json:"chapters"`
	Warnings         []storyFormatWarning `json:"warnings"`
	RemovedMarkerIDs []string             `json:"removed_marker_ids,omitempty"`
}

const (
	storyFormatSeverityError = "error"
	storyFormatSeverityInfo  = "info"
)

var (
	// 行首看起來像段落 marker 開頭（排除 span/a/footnote/comment 行內 marker 與 table），
	// 但整行沒有被 storyMarkerPattern 配對成功——代表結尾缺 ⟦/id⟧ 或前後 id 不一致。
	storyLooseParagraphOpenPattern  = regexp.MustCompile(`^⟦([^⟧\s/]+)[^⟧]*⟧`)
	storyLooseParagraphClosePattern = regexp.MustCompile(`⟦/([^⟧\s]+)⟧$`)
	storyInlineMarkerTokenPattern   = regexp.MustCompile(`⟦(/?)((?:span|a|footnote|comment)-[^⟧\s]+)`)
	storyGFMStrikethroughPattern    = regexp.MustCompile(`~~[^~]+~~`)
)

// checkStoryContentFormat 檢查 story／lore 內容的格式，規則全部重用存檔與章節工具已經在用的
// Go pattern，避免「驗證說 OK、存檔或閱讀頁解析出來又是另一回事」。
//
// 章節、字數以「存檔後的樣子」計算：非網頁來源存檔時會先把 marker 內的前綴搬到外面
// （hoistStoryMarkerBlockPrefixes），所以這類警告標成 auto_fixed_on_save，不計入 OK。
func checkStoryContentFormat(content string) storyFormatReport {
	report := storyFormatReport{Chapters: []storyFormatChapter{}, Warnings: []storyFormatWarning{}}
	lines := strings.Split(content, "\n")
	seenMarkerLines := map[string]int{}
	lastTableRowLine := map[string]int{}
	add := func(w storyFormatWarning) { report.Warnings = append(report.Warnings, w) }

	for i := 0; i < len(lines); i++ {
		line, lineNo := lines[i], i+1

		// code block：內容是 literal text 不檢查，只確認有沒有關起來
		if _, fenceID, ok := parseStoryCodeFenceOpen(line); ok {
			checkDuplicateMarkerID(fenceID, lineNo, seenMarkerLines, add)
			closed := false
			for i++; i < len(lines); i++ {
				if storyCodeFenceClosePattern.MatchString(lines[i]) {
					closed = true
					break
				}
			}
			if !closed {
				add(storyFormatWarning{Line: lineNo, Code: "unclosed_code_fence", Severity: storyFormatSeverityError,
					Message: "程式碼區塊沒有結尾的 ```，後面的內容會全部變成程式碼"})
			}
			report.Summary.Paragraphs++
			continue
		}

		// 表格列：同一個 tableId 的列必須相鄰，中間夾了別的行就會被拆成兩張表
		if tableID, _, ok := parseStoryTableMarker(line); ok {
			if last, seen := lastTableRowLine[tableID]; seen && last != i-1 {
				add(storyFormatWarning{Line: lineNo, Code: "table_rows_not_adjacent", Severity: storyFormatSeverityError,
					Message: fmt.Sprintf("表格 %q 的列沒有相鄰（上一列在第 %d 行），會被拆成兩張表", tableID, last+1)})
			}
			lastTableRowLine[tableID] = i
			continue
		}

		checkStoryParagraphFormat(line, lineNo, seenMarkerLines, add)
		if strings.TrimSpace(line) != "" {
			report.Summary.Paragraphs++
		}
	}

	// 章節與字數用存檔後的內容算，跟 storyteller_list_story_chapters 看到的一致
	saved := hoistStoryMarkerBlockPrefixes(content, "mcp")
	for _, span := range storyChapterSpans(saved) {
		report.Chapters = append(report.Chapters, storyFormatChapter{Level: span.HeadingLevel, Title: span.Title, MarkerID: span.MarkerID})
	}
	report.Summary.Chapters = len(report.Chapters)
	report.Summary.WordCount = storyWordCount(storytellerModel.ProjectContentTypeText, saved)
	report.OK = !hasBlockingStoryFormatWarning(report.Warnings)
	return report
}

// checkStoryParagraphFormat 檢查一般段落行：段落 marker 配對、id 重複、前綴位置、行內 marker 與樣式。
func checkStoryParagraphFormat(line string, lineNo int, seen map[string]int, add func(storyFormatWarning)) {
	// 前綴在 marker 外面是正確格式，剝掉後再看 marker（跟 backfillStoryMarkerIds 同一套順序）
	_, prefixEnd := storyHeadingPrefix(line)
	rest := line[prefixEnd:]
	if prefixEnd == 0 {
		rest = rest[len(blockKindPrefixPattern.FindString(rest)):]
	}

	inner := rest
	if match := storyMarkerPattern.FindStringSubmatch(rest); match != nil && match[1] == match[3] && match[1] != "" {
		inner = match[2]
		checkDuplicateMarkerID(match[1], lineNo, seen, add)
		if prefixEnd == 0 && line == rest {
			if hoisted := hoistStoryMarkerBlockPrefixes(line, "mcp"); hoisted != line {
				add(storyFormatWarning{Line: lineNo, Code: "block_prefix_inside_marker", Severity: storyFormatSeverityError,
					Message:         "標題／引用／清單的前綴包在段落 marker 裡面，會被當成文字印出來（MCP 存檔時會自動搬到外面）",
					AutoFixedOnSave: true, Suggestion: hoisted})
			}
		}
	} else if open := storyLooseParagraphOpenPattern.FindStringSubmatch(rest); open != nil && !isStoryInlineMarkerID(open[1]) {
		add(storyFormatWarning{Line: lineNo, Code: "unpaired_paragraph_marker", Severity: storyFormatSeverityError,
			Message: fmt.Sprintf("段落 marker ⟦%s⟧ 沒有成對的 ⟦/%s⟧ 結尾（或前後 id 不一致），整行會連符號一起印出來", open[1], open[1])})
	} else if closing := storyLooseParagraphClosePattern.FindStringSubmatch(rest); closing != nil && !isStoryInlineMarkerID(closing[1]) {
		add(storyFormatWarning{Line: lineNo, Code: "unpaired_paragraph_marker", Severity: storyFormatSeverityError,
			Message: fmt.Sprintf("段落結尾有 ⟦/%s⟧ 但開頭沒有對應的 ⟦%s⟧", closing[1], closing[1])})
	}

	checkStoryInlineFormat(inner, lineNo, add)
}

// checkStoryInlineFormat 檢查一段內文的行內 marker 與樣式符號。行內 marker 不會跨段落，所以逐行配對即可。
func checkStoryInlineFormat(text string, lineNo int, add func(storyFormatWarning)) {
	open := map[string]bool{}
	for _, m := range storyInlineMarkerTokenPattern.FindAllStringSubmatch(text, -1) {
		closing, id := m[1] == "/", m[2]
		switch {
		case !closing:
			open[id] = true
		case open[id]:
			delete(open, id)
		default:
			add(storyFormatWarning{Line: lineNo, Code: "unbalanced_inline_marker", Severity: storyFormatSeverityError,
				Message: fmt.Sprintf("行內 marker ⟦/%s⟧ 沒有對應的開頭", id)})
		}
	}
	for id := range open {
		msg := fmt.Sprintf("行內 marker ⟦%s⟧ 沒有結尾 ⟦/%s⟧", id, id)
		if strings.HasPrefix(id, "comment-") {
			msg += "；這是作者的私人註解，沒關好可能讓註解內容外露給讀者"
		}
		add(storyFormatWarning{Line: lineNo, Code: "unbalanced_inline_marker", Severity: storyFormatSeverityError, Message: msg})
	}

	// 樣式符號只看 marker 以外的可見文字，避免 note／comment 屬性裡的字被誤算
	visible := storyInlineMarkerPattern.ReplaceAllString(text, "")
	if storyGFMStrikethroughPattern.MatchString(visible) {
		add(storyFormatWarning{Line: lineNo, Code: "gfm_strikethrough", Severity: storyFormatSeverityError,
			Message: "SteamLoom 的刪除線是 --文字--；~~文字~~ 會被解析成下標"})
	}
	for _, mark := range []string{"**", "++"} {
		if strings.Count(visible, mark)%2 == 1 {
			add(storyFormatWarning{Line: lineNo, Code: "unbalanced_inline_style", Severity: storyFormatSeverityInfo,
				Message: fmt.Sprintf("這一段的 %s 數量是奇數，可能有一組沒關，符號會外露", mark)})
		}
	}
}

func checkDuplicateMarkerID(id string, lineNo int, seen map[string]int, add func(storyFormatWarning)) {
	if id == "" {
		return
	}
	if first, dup := seen[id]; dup {
		add(storyFormatWarning{Line: lineNo, Code: "duplicate_marker_id", Severity: storyFormatSeverityError,
			Message: fmt.Sprintf("段落 id %q 跟第 %d 行重複，書籤與大綱可能跳到錯的段落；新段落請用新的 id", id, first)})
		return
	}
	seen[id] = lineNo
}

func isStoryInlineMarkerID(id string) bool {
	for _, prefix := range []string{"span-", "a-", "footnote-", "comment-"} {
		if strings.HasPrefix(id, prefix) {
			return true
		}
	}
	return id == "table"
}

func hasBlockingStoryFormatWarning(warnings []storyFormatWarning) bool {
	for _, w := range warnings {
		if w.Severity == storyFormatSeverityError && !w.AutoFixedOnSave {
			return true
		}
	}
	return false
}

// storyFormatWarningsAfterSave 給寫入工具的回應用：檢查存檔後的內容，回傳非 nil 的切片，
// 讓 JSON 一定輸出 format_warnings（空陣列＝檢查過沒問題，跟「沒檢查」區分開）。
func storyFormatWarningsAfterSave(content string) *[]storyFormatWarning {
	warnings := checkStoryContentFormat(content).Warnings
	return &warnings
}

// storyContentMarkerIDs 收集有內容的段落 id（含 code block 的 id）。空白段落不算：
// 那些只是段落間距，作者不會在上面加書籤，列出來只會變成雜訊。
func storyContentMarkerIDs(content string) []string {
	ids := []string{}
	walkStoryContentLines(strings.Split(content, "\n"), func(_ int, line string) {
		if _, fenceID, ok := parseStoryCodeFenceOpen(line); ok {
			if fenceID != "" {
				ids = append(ids, fenceID)
			}
			return
		}
		_, prefixEnd := storyHeadingPrefix(line)
		rest := line[prefixEnd:]
		if prefixEnd == 0 {
			rest = rest[len(blockKindPrefixPattern.FindString(rest)):]
		}
		if match := storyMarkerPattern.FindStringSubmatch(rest); match != nil && match[1] == match[3] && match[1] != "" && strings.TrimSpace(match[2]) != "" {
			ids = append(ids, match[1])
		}
	})
	return ids
}

// removedStoryMarkerIDs 列出 previous 有、next 沒有的段落 id，保持 previous 裡的順序。
func removedStoryMarkerIDs(previous, next string) []string {
	kept := map[string]bool{}
	for _, id := range storyContentMarkerIDs(next) {
		kept[id] = true
	}
	removed := []string{}
	for _, id := range storyContentMarkerIDs(previous) {
		if !kept[id] {
			removed = append(removed, id)
		}
	}
	return removed
}
