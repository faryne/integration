package storyteller

import (
	"fmt"
	"regexp"
	"strings"
)

// 註解參照：作者私人註解（⟦comment-<id> comment="..." refs="lore:<id> story:<id>"⟧）可以夾幾篇同專案的
// 故事／設定，編輯區點註解就能邊寫邊看。refs 跟 comment 一樣只給作者看，閱讀頁、字數、搜尋都整段丟掉
// （storyInlineMarkerPattern 吃任意屬性），所以這裡只負責檢查格式與「指到的東西還在不在」。
//
// 刻意不用 steamloom-lore:// 這種 URI：那是讀者看得到的設定連結，lore_reference.go 會擋下指向不存在設定的存檔；
// 註解參照的那篇被刪掉時不該擋住作者存檔，編輯區顯示「已刪除」就好，所以只回報 info 等級的警告。
var (
	storyCommentOpenPattern = regexp.MustCompile(`⟦comment-[^⟧\s]+((?: [A-Za-z]+="(?:[^"\\]|\\.)*")*)⟧`)
	storyMarkerAttrPattern  = regexp.MustCompile(`([A-Za-z]+)="((?:[^"\\]|\\.)*)"`)
	storyCommentRefPattern  = regexp.MustCompile(`^(story|lore):([A-Za-z0-9._~-]+)$`)
)

// storyCommentRefMaxPerOne 跟前端 COMMENT_REFS_MAX 一致
const storyCommentRefMaxPerOne = 5

type storyCommentRef struct {
	Kind     string // story／lore
	PublicID string
}

// storyCommentRefs 抽出一段文字裡所有註解的 refs；invalid 是格式不對的 token（前端會直接忽略）
func storyCommentRefs(text string) (refs []storyCommentRef, invalid []string, tooMany bool) {
	for _, open := range storyCommentOpenPattern.FindAllStringSubmatch(text, -1) {
		for _, attr := range storyMarkerAttrPattern.FindAllStringSubmatch(open[1], -1) {
			if attr[1] != "refs" {
				continue
			}
			tokens := strings.Fields(unescapeMarkerAttr(attr[2]))
			tooMany = tooMany || len(tokens) > storyCommentRefMaxPerOne
			for _, token := range tokens {
				if m := storyCommentRefPattern.FindStringSubmatch(token); m != nil {
					refs = append(refs, storyCommentRef{Kind: m[1], PublicID: m[2]})
				} else {
					invalid = append(invalid, token)
				}
			}
		}
	}
	return refs, invalid, tooMany
}

// checkStoryCommentRefsFormat 是純格式檢查（不查 DB），掛在逐行的行內檢查裡
func checkStoryCommentRefsFormat(text string, lineNo int, add func(storyFormatWarning)) {
	_, invalid, tooMany := storyCommentRefs(text)
	if len(invalid) > 0 {
		add(storyFormatWarning{Line: lineNo, Code: "invalid_comment_reference", Severity: storyFormatSeverityInfo,
			Message:    fmt.Sprintf("註解的 refs 有看不懂的參照 %q，編輯器會忽略它", invalid),
			Suggestion: `refs 的格式是空白分隔的 story:<story_public_id> 或 lore:<lore_public_id>，例如 refs="lore:abc story:def"`})
	}
	if tooMany {
		add(storyFormatWarning{Line: lineNo, Code: "too_many_comment_references", Severity: storyFormatSeverityInfo,
			Message: fmt.Sprintf("一則註解最多 %d 個參照，多的編輯器不會顯示", storyCommentRefMaxPerOne)})
	}
}

// commentReferenceWarnings 檢查註解參照指到的故事／設定是否還在這個專案裡；找不到只是 info，不擋存檔
func (s *Service) commentReferenceWarnings(projectID uint64, content string) ([]storyFormatWarning, error) {
	refs, _, _ := storyCommentRefs(content)
	if len(refs) == 0 {
		return nil, nil
	}
	stories, lores, err := s.repo.ProjectTargetTitles(projectID)
	if err != nil {
		return nil, err
	}
	exists := map[string]bool{}
	for _, story := range stories {
		exists["story:"+story.PublicID] = true
	}
	for _, lore := range lores {
		exists["lore:"+lore.PublicID] = true
	}
	missing := []string{}
	for _, ref := range refs {
		if key := ref.Kind + ":" + ref.PublicID; !exists[key] {
			missing = append(missing, key)
		}
	}
	missing = uniqueStrings(missing)
	if len(missing) == 0 {
		return nil, nil
	}
	return []storyFormatWarning{{Code: "comment_reference_not_found", Severity: storyFormatSeverityInfo,
		Message:    fmt.Sprintf("註解參照指向這個專案裡找不到的故事／設定：%s；不會擋存檔，但作者點了會看到「已刪除」", strings.Join(missing, "、")),
		Suggestion: "用 storyteller_search_project 或 list 工具確認 public_id；不確定就別加 refs"}}, nil
}
