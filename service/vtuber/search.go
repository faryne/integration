package vtuber

import (
	"fmt"
	"slices"
	"strings"
	"unicode"
	"unicode/utf8"

	vtuberEntity "faryne.dev/model/entity/opendata/vtuber"
	vtuberRepository "faryne.dev/repository/vtuber"
)

const (
	channelSearchLimit    = 8   // 藝人搜尋框下拉最多幾筆
	maxSearchKeywordRunes = 100 // 關鍵字長度上限（藝人、影片搜尋共用）
	snippetLeadRunes      = 12  // 說明片段在命中處前面保留的字數
	snippetRunes          = 80  // 說明片段的長度
)

// SearchChannels 藝人搜尋框：查 DB 的名稱、@handle、頻道說明，期別名稱先換成 slug 再一起查。
// 命中只在說明時附上命中處附近的片段；空關鍵字回空清單
func SearchChannels(keyword string) ([]vtuberEntity.ChannelSearchItem, error) {
	keyword, err := normalizeKeyword(keyword)
	if err != nil || keyword == "" {
		return []vtuberEntity.ChannelSearchItem{}, err
	}
	channels, err := vtuberRepository.SearchActiveChannels(keyword, matchingUnitSlugs(keyword), channelSearchLimit)
	if err != nil {
		return nil, err
	}
	liveIDs, err := vtuberRepository.ListLiveChannelIDs()
	if err != nil {
		return nil, err
	}
	out := make([]vtuberEntity.ChannelSearchItem, 0, len(channels))
	for _, ch := range channels {
		item := vtuberEntity.ChannelSearchItem{ChannelSummary: channelSummary(ch, slices.Contains(liveIDs, ch.ChannelID))}
		unitName := ""
		if ch.UnitSlug != nil {
			if u := FindUnit(*ch.UnitSlug); u != nil {
				unitName = u.Name
			}
		}
		if !containsFold(ch.Title+" "+ch.Handle()+" "+unitName, keyword) && ch.Description != nil {
			item.DescriptionSnippet = descriptionSnippet(*ch.Description, keyword)
		}
		out = append(out, item)
	}
	return out, nil
}

// normalizeKeyword 去頭尾空白、連續空白縮成一個；太長回 ErrInvalidRequest
func normalizeKeyword(keyword string) (string, error) {
	keyword = strings.Join(strings.Fields(keyword), " ")
	if utf8.RuneCountInString(keyword) > maxSearchKeywordRunes {
		return "", fmt.Errorf("%w: keyword is at most %d characters", ErrInvalidRequest, maxSearchKeywordRunes)
	}
	return keyword, nil
}

// matchingUnitSlugs 期別名稱含關鍵字的 slug（期別名稱是程式常數，不在 DB）
func matchingUnitSlugs(keyword string) []string {
	var out []string
	for _, u := range Units {
		if containsFold(u.Name, keyword) {
			out = append(out, u.Slug)
		}
	}
	return out
}

func containsFold(s, sub string) bool {
	return strings.Contains(strings.ToLower(s), strings.ToLower(sub))
}

// descriptionSnippet 從命中處前一點開始取一段說明，換行收成空格；
// DB 比對比 Go 寬鬆（例如全半形），Go 找不到命中處時就取開頭
func descriptionSnippet(desc, keyword string) string {
	runes := []rune(desc)
	start := runeIndexFold(runes, []rune(keyword)) - snippetLeadRunes
	start = max(0, start)
	end := min(len(runes), start+snippetRunes)
	snippet := strings.Join(strings.Fields(string(runes[start:end])), " ")
	if start > 0 {
		snippet = "…" + snippet
	}
	if end < len(runes) {
		snippet += "…"
	}
	return snippet
}

// runeIndexFold 不分大小寫找子字串的 rune 位置（逐字轉小寫，長度不會跑掉）；找不到回 -1
func runeIndexFold(s, sub []rune) int {
	for i := 0; i+len(sub) <= len(s); i++ {
		match := true
		for j := range sub {
			if unicode.ToLower(s[i+j]) != unicode.ToLower(sub[j]) {
				match = false
				break
			}
		}
		if match {
			return i
		}
	}
	return -1
}
