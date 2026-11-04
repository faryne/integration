package av

import (
	"encoding/json"
	"reflect"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	avEntity "faryne.dev/model/entity/opendata/av"
)

// 影片修改欄位的上限；合輯的出演可能上百位，清單上限放寬
const (
	videoMaxTitleLen   = 500
	videoMaxMakerNoLen = 50
	videoMaxTermLen    = 100
	videoMaxTermItems  = 200
	videoMaxDuration   = 2000
)

// 日期接受 YYYY/MM/DD 或 YYYY-MM-DD，一律存成 DMM 同步用的 YYYY/MM/DD
var videoDatePattern = regexp.MustCompile(`^(\d{4})[/-](\d{1,2})[/-](\d{1,2})$`)

// 陣列欄位的中文名稱（錯誤訊息用）
var videoTermLabels = map[string]string{
	"actresses": "出演", "directors": "監督", "series": "系列", "makers": "發售商", "labels": "品牌", "tags": "標籤",
}

// normalizeVideoFields 去頭尾空白、日期統一格式、清單去重複，並檢查欄位範圍。
// 欄位驗證錯誤沿用女優的 ErrActressInvalid（controller 一樣回 400）
func normalizeVideoFields(f avEntity.VideoFields) (avEntity.VideoFields, error) {
	f.Title, f.MakerNo = strings.TrimSpace(f.Title), strings.TrimSpace(f.MakerNo)
	if f.Title == "" {
		return f, invalidActress("標題必填")
	}
	if utf8.RuneCountInString(f.Title) > videoMaxTitleLen {
		return f, invalidActress("標題太長")
	}
	if utf8.RuneCountInString(f.MakerNo) > videoMaxMakerNoLen {
		return f, invalidActress("官方番號太長")
	}
	var err error
	if f.VodDate, err = normalizeVideoDate(f.VodDate, "配信日"); err != nil {
		return f, err
	}
	if f.PublishDate, err = normalizeVideoDate(f.PublishDate, "發售日"); err != nil {
		return f, err
	}
	if f.Duration < 0 || f.Duration > videoMaxDuration {
		return f, invalidActress("片長超出範圍")
	}
	for key, list := range videoTermLists(&f) {
		*list = normalizeTerms(*list)
		if len(*list) > videoMaxTermItems {
			return f, invalidActress("%s最多 %d 筆", videoTermLabels[key], videoMaxTermItems)
		}
		for _, v := range *list {
			if utf8.RuneCountInString(v) > videoMaxTermLen {
				return f, invalidActress("%s太長：%s", videoTermLabels[key], v)
			}
		}
	}
	if f.Links, err = normalizeLinks(f.Links); err != nil {
		return f, err
	}
	return f, nil
}

// videoTermLists 陣列欄位 json key → 欄位指標，驗證與正規化時逐一處理
func videoTermLists(f *avEntity.VideoFields) map[string]*[]string {
	return map[string]*[]string{
		"actresses": &f.Actresses, "directors": &f.Directors, "series": &f.Series,
		"makers": &f.Makers, "labels": &f.Labels, "tags": &f.Tags,
	}
}

func normalizeVideoDate(raw, label string) (string, error) {
	if raw = strings.TrimSpace(raw); raw == "" {
		return "", nil
	}
	m := videoDatePattern.FindStringSubmatch(raw)
	if m == nil {
		return "", invalidActress("%s格式不正確（YYYY/MM/DD）", label)
	}
	y, _ := strconv.Atoi(m[1])
	mo, _ := strconv.Atoi(m[2])
	d, _ := strconv.Atoi(m[3])
	t := time.Date(y, time.Month(mo), d, 0, 0, 0, 0, time.UTC)
	// time.Date 會把 2/30 進位成 3/2，轉回來不一樣就是不存在的日期
	if t.Year() != y || int(t.Month()) != mo || t.Day() != d {
		return "", invalidActress("%s不是有效的日期", label)
	}
	return t.Format("2006/01/02"), nil
}

// normalizeTerms 去頭尾空白、去掉空字串、去重複，保留先出現的順序；回傳一定不是 nil
func normalizeTerms(in []string) []string {
	out := make([]string, 0, len(in))
	for _, v := range in {
		if v = strings.TrimSpace(v); v != "" && !slices.Contains(out, v) {
			out = append(out, v)
		}
	}
	return out
}

// videoFieldMap 轉成 json key → 值，diff 與覆寫都以 key 為單位處理
func videoFieldMap(f avEntity.VideoFields) map[string]any {
	for _, list := range videoTermLists(&f) {
		*list = nonNil(*list)
	}
	f.Links = nonNil(f.Links)
	raw, _ := json.Marshal(f)
	m := map[string]any{}
	_ = json.Unmarshal(raw, &m)
	return m
}

func videoFieldsFromMap(m map[string]any) avEntity.VideoFields {
	raw, _ := json.Marshal(m)
	var f avEntity.VideoFields
	_ = json.Unmarshal(raw, &f)
	for _, list := range videoTermLists(&f) {
		*list = nonNil(*list)
	}
	f.Links = nonNil(f.Links)
	return f
}

// changedVideoFields 兩份資料不同的可編輯欄位
func changedVideoFields(a, b avEntity.VideoFields) []string {
	am, bm := videoFieldMap(a), videoFieldMap(b)
	var keys []string
	for _, k := range avEntity.VideoEditableFields {
		if !reflect.DeepEqual(am[k], bm[k]) {
			keys = append(keys, k)
		}
	}
	return keys
}

// applyVideoFields 把 src 的指定欄位寫到 dst（MCP 只改有傳的欄位時用）
func applyVideoFields(dst, src avEntity.VideoFields, keys []string) avEntity.VideoFields {
	dm, sm := videoFieldMap(dst), videoFieldMap(src)
	for _, k := range keys {
		dm[k] = sm[k]
	}
	return videoFieldsFromMap(dm)
}

// videoFieldsFromSource 從 ES 文件取出可編輯欄位。logstash 時代的舊文件型別不一定整齊
// （directors／series 是 []interface{}、publish_date 可能不是字串），逐欄寬鬆轉換；清單順便正規化，
// 才不會因為舊資料有空白或重複，讓沒動過的表單也被判成有變更
func videoFieldsFromSource(src map[string]any) avEntity.VideoFields {
	f := avEntity.VideoFields{
		Title: sourceString(src["title"]), MakerNo: sourceString(src["maker_no"]),
		VodDate: sourceString(src["vod_date"]), PublishDate: sourceString(src["publish_date"]),
		Duration: sourceInt(src["duration"]),
	}
	for key, list := range videoTermLists(&f) {
		*list = normalizeTerms(sourceStrings(src[key]))
	}
	raw, _ := json.Marshal(src["links"])
	_ = json.Unmarshal(raw, &f.Links)
	f.Links = nonNil(f.Links)
	return f
}

func sourceString(v any) string {
	if s, ok := v.(string); ok {
		return strings.TrimSpace(s)
	}
	return ""
}

func sourceInt(v any) int {
	switch n := v.(type) {
	case float64:
		return int(n)
	case string:
		i, _ := strconv.Atoi(n)
		return i
	}
	return 0
}

// sourceStrings 字串陣列，保留空字串（actress_ids 靠位置跟 actresses 對齊）；單一字串也當成一筆
func sourceStrings(v any) []string {
	switch list := v.(type) {
	case string:
		return []string{list}
	case []any:
		out := make([]string, 0, len(list))
		for _, item := range list {
			s, _ := item.(string)
			out = append(out, s)
		}
		return out
	}
	return []string{}
}

// applyVideoValues 把 values（json key → 值）裡指定的欄位寫進 ES 文件。
// 出演改過時重新對齊 actress_ids，但原本沒有 actress_ids 的舊片維持沒有：
// 女優頁靠「沒有 actress_ids」把舊片算給對照表裡的同名女優（見 actressVideoQuery），補上空陣列影片就會從她的頁面消失
func applyVideoValues(src map[string]any, values map[string]any, keys []string) {
	oldNames := sourceStrings(src["actresses"])
	for _, k := range keys {
		if v, ok := values[k]; ok && slices.Contains(avEntity.VideoEditableFields, k) {
			src[k] = v
		}
	}
	if ids, ok := src["actress_ids"]; ok && slices.Contains(keys, "actresses") {
		src["actress_ids"] = alignActressIDs(oldNames, sourceStrings(ids), sourceStrings(src["actresses"]))
	}
}

// alignActressIDs 出演名單改過後，讓 actress_ids 跟新名單一樣長、位置對得上：
// 留下來的名字沿用原本的 DMM ID（同名出現多次時依序取用），新加的名字給空字串（女優頁會退回用名字比對）
func alignActressIDs(oldNames, oldIDs, newNames []string) []string {
	pool := map[string][]string{}
	for i, name := range oldNames {
		id := ""
		if i < len(oldIDs) {
			id = oldIDs[i]
		}
		pool[name] = append(pool[name], id)
	}
	out := make([]string, 0, len(newNames))
	for _, name := range newNames {
		id := ""
		if ids := pool[name]; len(ids) > 0 {
			id, pool[name] = ids[0], ids[1:]
		}
		out = append(out, id)
	}
	return out
}

// applyVideoOverrides 把 dmm_video_overrides 的覆寫蓋到 ES 文件上（DMM 同步寫入前用）
func applyVideoOverrides(src map[string]any, raw string) {
	overrides := map[string]any{}
	if json.Unmarshal([]byte(raw), &overrides) != nil || len(overrides) == 0 {
		return
	}
	keys := make([]string, 0, len(overrides))
	for _, k := range avEntity.VideoEditableFields {
		if _, ok := overrides[k]; ok {
			keys = append(keys, k)
		}
	}
	applyVideoValues(src, overrides, keys)
}

// mergeVideoOverrides 核准時把這次改的欄位併進既有覆寫
func mergeVideoOverrides(raw string, f avEntity.VideoFields, keys []string) string {
	overrides := map[string]any{}
	_ = json.Unmarshal([]byte(raw), &overrides)
	values := videoFieldMap(f)
	for _, k := range keys {
		overrides[k] = values[k]
	}
	out, _ := json.Marshal(overrides)
	return string(out)
}

// addedTerms 每個陣列欄位裡，after 有但 before 沒有的值（新值檢查、同名女優提醒用）
func addedTerms(before, after avEntity.VideoFields) map[string][]string {
	bm, am := videoTermLists(&before), videoTermLists(&after)
	out := map[string][]string{}
	for _, key := range avEntity.VideoTermFields {
		for _, v := range *am[key] {
			if !slices.Contains(*bm[key], v) {
				out[key] = append(out[key], v)
			}
		}
	}
	return out
}
