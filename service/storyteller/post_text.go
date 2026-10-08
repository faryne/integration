package storyteller

import (
	"fmt"
	"regexp"
	"strings"
	"unicode/utf8"
)

// 作者動態／留言的純文字處理。內文存 [spoiler]…[/spoiler]、[r18]…[/r18] 純文字標記，
// 顯示時由前端摺起來；後端只負責驗證字數與產生「遮掉標記內容」的摘要。

// spoilerMarkerRegexp 對應前端的解析：同種標記成對、非巢狀、最短匹配；沒關閉的標記不算。
// Go 的 regexp 沒有 backreference，所以兩種標記各寫一次。
var spoilerMarkerRegexp = regexp.MustCompile(`\[spoiler\][\s\S]*?\[/spoiler\]|\[r18\][\s\S]*?\[/r18\]`)

// PostValidationError 是動態／留言的輸入錯誤，controller 一律轉成 400 並直接顯示訊息。
type PostValidationError string

func (e PostValidationError) Error() string { return string(e) }

// postExcerptRunes 是通知裡貼文／留言摘要的長度
const postExcerptRunes = 80

// maskSpoilers 把標記內容換成［劇透］／［R18］：通知、分享預覽等摘要一律先遮，前端拿不到原文。
func maskSpoilers(text string) string {
	return spoilerMarkerRegexp.ReplaceAllStringFunc(text, func(match string) string {
		if strings.HasPrefix(match, "[r18]") {
			return "［R18］"
		}
		return "［劇透］"
	})
}

// postExcerpt 是遮蔽後再截斷的單行摘要（換行壓成空白）。先遮再截，避免截斷把標記切成「沒關閉」而外洩。
func postExcerpt(text string) string {
	text = strings.Join(strings.Fields(maskSpoilers(text)), " ")
	if utf8.RuneCountInString(text) <= postExcerptRunes {
		return text
	}
	return string([]rune(text)[:postExcerptRunes]) + "…"
}

// normalizePostBody 去掉頭尾空白並檢查字數（標記本身也算字數）；label 是錯誤訊息裡的名稱。
func normalizePostBody(body, label string, maxRunes int) (string, error) {
	body = strings.TrimSpace(strings.ReplaceAll(body, "\r\n", "\n"))
	if body == "" {
		return "", PostValidationError(label + "不能是空的")
	}
	if utf8.RuneCountInString(body) > maxRunes {
		return "", PostValidationError(fmt.Sprintf("%s最多 %d 字", label, maxRunes))
	}
	return body, nil
}
