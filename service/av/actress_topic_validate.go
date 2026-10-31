package av

import (
	"errors"
	"fmt"
	"regexp"
	"slices"
	"strings"
	"unicode/utf8"

	avEntity "faryne.dev/model/entity/opendata/av"
)

// ErrActressTopicInvalid 自訂主題的欄位或條件不合法；Error() 是給管理員看的中文原因
var ErrActressTopicInvalid = errors.New("invalid actress topic")

type actressTopicInvalidError struct{ reason string }

func (e actressTopicInvalidError) Error() string        { return e.reason }
func (e actressTopicInvalidError) Is(target error) bool { return target == ErrActressTopicInvalid }

func invalidTopic(format string, args ...any) error {
	return actressTopicInvalidError{fmt.Sprintf(format, args...)}
}

var (
	topicSlugPattern = regexp.MustCompile(`^[a-z0-9-]{2,50}$`)
	// 內建主題用掉的 slug 與前綴，自訂主題不能撞到；manage 是管理頁的路徑
	topicReservedSlugs    = []string{"manage", "newcomer", "active"}
	topicReservedPrefixes = []string{"horoscope-", "born-", "pref-", "genre-"}
	topicBloodTypes       = []string{"A", "B", "O", "AB"}
	topicCustomGroups     = []string{topicGroupSpecial, topicGroupBody}
	topicDefaultSorts     = []string{topicSortVideos, topicSortRecent, topicSortGenre, topicSortDebut}
)

// normalizeActressTopic 整理並檢查自訂主題（slug 重複另外由呼叫端查 DB）
func normalizeActressTopic(req avEntity.ActressTopicSaveRequest) (avEntity.ActressTopicSaveRequest, error) {
	req.Title = strings.TrimSpace(req.Title)
	req.Slug = strings.ToLower(strings.TrimSpace(req.Slug))
	switch n := utf8.RuneCountInString(req.Title); {
	case n == 0:
		return req, invalidTopic("請輸入標題")
	case n > 50:
		return req, invalidTopic("標題最多 50 個字")
	}
	if !topicSlugPattern.MatchString(req.Slug) {
		return req, invalidTopic("slug 只能用小寫英數與 -，長度 2～50")
	}
	if slices.Contains(topicReservedSlugs, req.Slug) || slices.ContainsFunc(topicReservedPrefixes, func(p string) bool { return strings.HasPrefix(req.Slug, p) }) {
		return req, invalidTopic("slug「%s」跟內建主題衝突，請換一個", req.Slug)
	}
	if !slices.Contains(topicCustomGroups, req.GroupKey) {
		return req, invalidTopic("分組只能是特輯或身材")
	}
	if !slices.Contains(topicDefaultSorts, req.DefaultSort) {
		return req, invalidTopic("預設排序不合法")
	}
	c, err := normalizeTopicConditions(req.Conditions)
	if err != nil {
		return req, err
	}
	if req.DefaultSort == topicSortGenre && len(c.Genres) == 0 {
		return req, invalidTopic("預設排序用類型出演數時，至少要有一個類型條件")
	}
	req.Conditions = c
	return req, nil
}

// normalizeTopicConditions 去重複、去空白，檢查區間與選項；完全沒有條件會變成「全部女優」，不允許
func normalizeTopicConditions(c avEntity.ActressTopicConditions) (avEntity.ActressTopicConditions, error) {
	var err error
	signs := make([]string, 0, len(horoscopeSigns))
	for _, s := range horoscopeSigns {
		signs = append(signs, s.Slug)
	}
	if c.Horoscope, err = pickTopicValues(c.Horoscope, signs, "星座"); err != nil {
		return c, err
	}
	if c.Blood, err = pickTopicValues(c.Blood, topicBloodTypes, "血型"); err != nil {
		return c, err
	}
	c.BornCity = compactTopicStrings(c.BornCity)
	for _, r := range []struct {
		label string
		rng   [2]int
	}{{"出生年", c.BirthYear}, {"身高", c.Height}, {"胸圍", c.Bust}, {"腰圍", c.Waist}, {"臀圍", c.Hips}, {"臀腰差", c.HipWaistDiff}} {
		if r.rng[0] < 0 || r.rng[1] < 0 || (r.rng[0] > 0 && r.rng[1] > 0 && r.rng[0] > r.rng[1]) {
			return c, invalidTopic("%s的最小值不能大於最大值", r.label)
		}
	}
	for i, cup := range c.Cup {
		c.Cup[i] = strings.ToUpper(strings.TrimSpace(cup))
		if c.Cup[i] != "" && cupRank(c.Cup[i]) == 0 {
			return c, invalidTopic("罩杯「%s」不合法", cup)
		}
	}
	if c.Cup[0] != "" && c.Cup[1] != "" && cupRank(c.Cup[0]) > cupRank(c.Cup[1]) {
		return c, invalidTopic("罩杯的最小值不能大於最大值")
	}
	genres := make([]avEntity.ActressTopicGenreCondition, 0, len(c.Genres))
	for _, g := range c.Genres {
		g.Tag = strings.TrimSpace(g.Tag)
		if g.Tag == "" || slices.ContainsFunc(genres, func(x avEntity.ActressTopicGenreCondition) bool { return x.Tag == g.Tag }) {
			continue
		}
		genres = append(genres, avEntity.ActressTopicGenreCondition{Tag: g.Tag, Min: max(g.Min, 1)})
	}
	c.Genres = genres
	if c.DebutWithinMonths < 0 || c.ActiveWithinMonths < 0 || c.MinVideos < 0 {
		return c, invalidTopic("月數與出演數不能是負數")
	}
	if topicConditionSummary(c) == "" {
		return c, invalidTopic("至少要設定一個條件")
	}
	return c, nil
}

// pickTopicValues 只能從 allowed 裡選，去重複並保留 allowed 的順序
func pickTopicValues(values, allowed []string, label string) ([]string, error) {
	for _, v := range values {
		if !slices.Contains(allowed, v) {
			return nil, invalidTopic("%s「%s」不合法", label, v)
		}
	}
	return slices.DeleteFunc(slices.Clone(allowed), func(v string) bool { return !slices.Contains(values, v) }), nil
}

func compactTopicStrings(values []string) []string {
	out := make([]string, 0, len(values))
	for _, v := range values {
		if v = strings.TrimSpace(v); v != "" && !slices.Contains(out, v) {
			out = append(out, v)
		}
	}
	return out
}
