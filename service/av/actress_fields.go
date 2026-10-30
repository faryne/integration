package av

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/url"
	"reflect"
	"regexp"
	"slices"
	"strings"
	"time"
	"unicode/utf8"

	avEntity "faryne.dev/model/entity/opendata/av"
)

// 上稿欄位的上限：數值超過這些範圍幾乎都是打錯
const (
	actressMaxHeight    = 250
	actressMaxSize      = 200
	actressMaxTextLen   = 100
	actressMaxURLLen    = 500
	actressMaxListItems = 20
)

// 罩杯只收 AAA、AA、A～Z（xcity 現有資料最大到 U）
var actressCupPattern = regexp.MustCompile(`^(A{1,3}|[B-Z])$`)

// ErrActressInvalid 欄位驗證失敗，controller 回 400；Error() 只有中文原因，直接顯示給使用者
var ErrActressInvalid = errors.New("invalid actress fields")

type actressInvalidError struct{ reason string }

func (e actressInvalidError) Error() string        { return e.reason }
func (e actressInvalidError) Is(target error) bool { return target == ErrActressInvalid }

func invalidActress(format string, args ...any) error {
	return actressInvalidError{reason: fmt.Sprintf(format, args...)}
}

// normalizeActressFields 去頭尾空白、罩杯轉大寫、清單去重複，並檢查欄位範圍；
// 回傳的 Interests／Links 一定不是 nil，diff 時空陣列與 nil 才不會被當成不同
func normalizeActressFields(f avEntity.ActressFields) (avEntity.ActressFields, error) {
	f.Name, f.Kana, f.Photo = strings.TrimSpace(f.Name), strings.TrimSpace(f.Kana), strings.TrimSpace(f.Photo)
	f.Cup, f.Blood = strings.ToUpper(strings.TrimSpace(f.Cup)), strings.ToUpper(strings.TrimSpace(f.Blood))
	// 星座不開放填、DMM 女優 ID 只給內部爬蟲寫入，提交內容一律清空
	f.BornCity, f.Horoscope, f.DMMID = strings.TrimSpace(f.BornCity), "", ""

	if f.Name == "" {
		return f, invalidActress("姓名必填")
	}
	for label, v := range map[string]string{"姓名": f.Name, "假名": f.Kana, "出生地": f.BornCity, "血型": f.Blood} {
		if utf8.RuneCountInString(v) > actressMaxTextLen {
			return f, invalidActress("%s太長", label)
		}
	}
	if f.Cup != "" && !actressCupPattern.MatchString(f.Cup) {
		return f, invalidActress("罩杯格式不正確（AAA、AA、A～Z）")
	}
	// xcity 的照片是「//faws.xcity.jp/...」這種省略協定的網址，也要能原樣送回
	if f.Photo != "" && !isHTTPURL(f.Photo) && !isHTTPURL("https:"+f.Photo) {
		return f, invalidActress("照片網址必須是 http(s) 網址")
	}
	if f.Height < 0 || f.Height > actressMaxHeight {
		return f, invalidActress("身高超出範圍")
	}
	for _, v := range []int{f.Bust, f.Waist, f.Hips} {
		if v < 0 || v > actressMaxSize {
			return f, invalidActress("三圍超出範圍")
		}
	}
	if f.BirthYear != 0 && (f.BirthYear < 1900 || f.BirthYear > time.Now().Year()) ||
		f.BirthMonth < 0 || f.BirthMonth > 12 || f.BirthDay < 0 || f.BirthDay > 31 {
		return f, invalidActress("生日超出範圍")
	}

	interests := make([]string, 0, len(f.Interests))
	for _, v := range f.Interests {
		if v = strings.TrimSpace(v); v != "" && !slices.Contains(interests, v) {
			interests = append(interests, v)
		}
	}
	links := make([]avEntity.ActressLink, 0, len(f.Links))
	for _, l := range f.Links {
		l.Title, l.URL = strings.TrimSpace(l.Title), strings.TrimSpace(l.URL)
		if l.URL == "" {
			continue
		}
		if !isHTTPURL(l.URL) || utf8.RuneCountInString(l.Title) > actressMaxTextLen {
			return f, invalidActress("參考連結格式不正確：%s", l.URL)
		}
		if !slices.ContainsFunc(links, func(x avEntity.ActressLink) bool { return x.URL == l.URL }) {
			links = append(links, l)
		}
	}
	if len(interests) > actressMaxListItems || len(links) > actressMaxListItems {
		return f, invalidActress("興趣或參考連結最多 %d 筆", actressMaxListItems)
	}
	f.Interests, f.Links = interests, links
	return f, nil
}

func isHTTPURL(raw string) bool {
	u, err := url.Parse(raw)
	return err == nil && (u.Scheme == "http" || u.Scheme == "https") && u.Host != "" && len(raw) <= actressMaxURLLen
}

// actressFieldMap 轉成 json key → 值，diff 與覆寫都以 key 為單位處理
func actressFieldMap(f avEntity.ActressFields) map[string]any {
	f.Interests, f.Links = nonNil(f.Interests), nonNil(f.Links)
	raw, _ := json.Marshal(f)
	m := map[string]any{}
	_ = json.Unmarshal(raw, &m)
	return m
}

func actressFieldsFromMap(m map[string]any) avEntity.ActressFields {
	raw, _ := json.Marshal(m)
	var f avEntity.ActressFields
	_ = json.Unmarshal(raw, &f)
	f.Interests, f.Links = nonNil(f.Interests), nonNil(f.Links)
	return f
}

func nonNil[T any](s []T) []T {
	if s == nil {
		return []T{}
	}
	return s
}

// changedActressFields 兩份資料不同的可編輯欄位
func changedActressFields(a, b avEntity.ActressFields) []string {
	am, bm := actressFieldMap(a), actressFieldMap(b)
	var keys []string
	for _, k := range avEntity.ActressEditableFields {
		if !reflect.DeepEqual(am[k], bm[k]) {
			keys = append(keys, k)
		}
	}
	return keys
}

// applyActressFields 把 src 的指定欄位寫到 dst
func applyActressFields(dst, src avEntity.ActressFields, keys []string) avEntity.ActressFields {
	dm, sm := actressFieldMap(dst), actressFieldMap(src)
	for _, k := range keys {
		dm[k] = sm[k]
	}
	return actressFieldsFromMap(dm)
}

// mergeActressFields 新增單合併到同名女優：提交有填的欄位覆寫、沒填的保留；興趣與參考連結取聯集。
// 回傳合併結果與實際變動的欄位
func mergeActressFields(current, submitted avEntity.ActressFields) (avEntity.ActressFields, []string) {
	cm, sm := actressFieldMap(current), actressFieldMap(submitted)
	for _, k := range avEntity.ActressEditableFields {
		if v := sm[k]; v != nil && !reflect.ValueOf(v).IsZero() && k != "interests" && k != "links" {
			cm[k] = v
		}
	}
	merged := actressFieldsFromMap(cm)
	for _, v := range submitted.Interests {
		if !slices.Contains(merged.Interests, v) {
			merged.Interests = append(merged.Interests, v)
		}
	}
	for _, l := range submitted.Links {
		if !slices.ContainsFunc(merged.Links, func(x avEntity.ActressLink) bool { return x.URL == l.URL }) {
			merged.Links = append(merged.Links, l)
		}
	}
	return merged, changedActressFields(current, merged)
}

// decodeActressOverrides／encodeActressOverrides dmm_actresses.overrides：只存被手動改的欄位
func decodeActressOverrides(raw *string) map[string]json.RawMessage {
	out := map[string]json.RawMessage{}
	if raw != nil {
		_ = json.Unmarshal([]byte(*raw), &out)
	}
	return out
}

func encodeActressOverrides(overrides map[string]json.RawMessage) *string {
	if len(overrides) == 0 {
		return nil
	}
	raw, _ := json.Marshal(overrides)
	s := string(raw)
	return &s
}

// withActressOverrides 把手動覆寫的欄位蓋到資料上（xcity 同步寫入前用）
func withActressOverrides(f avEntity.ActressFields, overrides map[string]json.RawMessage) avEntity.ActressFields {
	if len(overrides) == 0 {
		return f
	}
	m := actressFieldMap(f)
	for k, v := range overrides {
		var value any
		if slices.Contains(avEntity.ActressEditableFields, k) && json.Unmarshal(v, &value) == nil {
			m[k] = value
		}
	}
	return actressFieldsFromMap(m)
}

// addActressOverrides 核准修改 xcity 女優時，把這次改的欄位加進覆寫
func addActressOverrides(overrides map[string]json.RawMessage, f avEntity.ActressFields, keys []string) map[string]json.RawMessage {
	m := actressFieldMap(f)
	for _, k := range keys {
		overrides[k], _ = json.Marshal(m[k])
	}
	return overrides
}
