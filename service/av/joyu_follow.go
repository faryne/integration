package av

import (
	"errors"
	"net/url"
	"slices"
	"strconv"
	"strings"
	"unicode/utf8"

	avEntity "faryne.dev/model/entity/opendata/av"
	avRepo "faryne.dev/repository/av"
)

// joyu.fyi 的追蹤：女優、發售商、品牌、系列、監督、標籤，以及影片搜尋頁「追蹤這個搜尋」存下的一組條件。
// 帳號在 Firebase（joyu-firebase），這裡只認 uid；資料規格見 DevelopDocuments/opendata/joyu.fyi社群功能第一期_2026-11-08.md

// joyuFollowLimit 每人最多追蹤幾筆
const joyuFollowLimit = 500

var (
	ErrFollowInvalid = errors.New("追蹤的內容不正確")
	ErrFollowLimit   = errors.New("追蹤數量已達上限（500 筆）")
)

// followNameKinds 直接存名稱的類型，對應影片搜尋的精確條件參數
var followNameKinds = []string{
	avEntity.FollowKindMaker, avEntity.FollowKindLabel, avEntity.FollowKindSeries,
	avEntity.FollowKindDirector, avEntity.FollowKindTag,
}

// searchFollowKeys 「追蹤這個搜尋」收的條件：關鍵字、女優（加指定是哪一位的 ID）與各精確條件；日期、頁碼不收
var searchFollowKeys = []string{"keyword", "actress", "xcity_id", "manual_id", "dmm_id", "maker", "label", "series", "director", "tag"}

// searchFollowSingleKeys 只收一個值的參數；其他（出演、發售商…、標籤）可複選
var searchFollowSingleKeys = []string{"keyword", "xcity_id", "manual_id", "dmm_id"}

// searchFollowConditionKeys 至少要有其中一個才收（只有女優 ID 沒有名字不算）
var searchFollowConditionKeys = []string{"keyword", "actress", "maker", "label", "series", "director", "tag"}

// normalizeFollow 檢查並正規化追蹤內容，同一個對象不論怎麼送來都存成同一個 value
func normalizeFollow(kind, value string) (string, error) {
	value = strings.TrimSpace(value)
	switch {
	case kind == avEntity.FollowKindActress:
		domain, aid, ok := parseActressFollow(value)
		if !ok {
			return "", ErrFollowInvalid
		}
		return domain + ":" + strconv.Itoa(aid), nil
	case kind == avEntity.FollowKindSearch:
		return normalizeSearchFollow(value)
	case slices.Contains(followNameKinds, kind):
		if value == "" || utf8.RuneCountInString(value) > 255 {
			return "", ErrFollowInvalid
		}
		return value, nil
	}
	return "", ErrFollowInvalid
}

// parseActressFollow 女優追蹤的 value 是 domain:aid（xcity 或手動上稿），改名、同名都分得開
func parseActressFollow(value string) (string, int, bool) {
	domain, idText, ok := strings.Cut(value, ":")
	aid, err := strconv.Atoi(idText)
	if !ok || err != nil || aid <= 0 || !slices.Contains(actressSearchDomains, domain) {
		return "", 0, false
	}
	return domain, aid, true
}

// normalizeSearchFollow 只留收的條件、去掉空值，每個參數的值去重排序（點選順序不同也存成同一筆），
// 參數依名稱排序（url.Values.Encode 本來就會排）；關鍵字與女優 ID 只留一個值，兩位以上出演時不存女優 ID（跟搜尋規則一致）；
// 至少要有一個條件（searchFollowConditionKeys）
func normalizeSearchFollow(raw string) (string, error) {
	parsed, err := url.ParseQuery(strings.TrimPrefix(raw, "?"))
	if err != nil {
		return "", ErrFollowInvalid
	}
	out := url.Values{}
	for _, key := range searchFollowKeys {
		var values []string
		for _, v := range parsed[key] {
			if v = strings.TrimSpace(v); v != "" && !slices.Contains(values, v) {
				values = append(values, v)
			}
		}
		if len(values) == 0 {
			continue
		}
		if slices.Contains(searchFollowSingleKeys, key) {
			values = values[:1]
		} else {
			slices.Sort(values)
		}
		out[key] = values
	}
	if len(out["actress"]) > 1 {
		for _, k := range []string{"xcity_id", "manual_id", "dmm_id"} {
			delete(out, k)
		}
	}
	hasCondition := slices.ContainsFunc(searchFollowConditionKeys, func(k string) bool { return len(out[k]) > 0 })
	if !hasCondition {
		return "", ErrFollowInvalid
	}
	encoded := out.Encode()
	if utf8.RuneCountInString(encoded) > 512 {
		return "", ErrFollowInvalid
	}
	return encoded, nil
}

// ListJoyuFollows 全站畫愛心狀態用的輕量清單
func ListJoyuFollows(uid string) ([]avEntity.JoyuFollow, error) {
	return avRepo.NewJoyuFollow().ListByUID(uid)
}

func AddJoyuFollow(uid string, req avEntity.JoyuFollowRequest) error {
	value, err := normalizeFollow(req.Kind, req.Value)
	if err != nil {
		return err
	}
	repo := avRepo.NewJoyuFollow()
	n, err := repo.CountByUID(uid)
	if err != nil {
		return err
	}
	if n >= joyuFollowLimit {
		return ErrFollowLimit
	}
	return repo.Add(uid, req.Kind, value)
}

func RemoveJoyuFollow(uid string, req avEntity.JoyuFollowRequest) error {
	value, err := normalizeFollow(req.Kind, req.Value)
	if err != nil {
		return err
	}
	return avRepo.NewJoyuFollow().Remove(uid, req.Kind, value)
}

// MergeJoyuFollows 匿名帳號升級時遇到既有的 Google 帳號：把匿名帳號的追蹤搬過去（重複的略過）
func MergeJoyuFollows(fromUID, toUID string) error {
	if fromUID == "" || fromUID == toUID {
		return nil
	}
	return avRepo.NewJoyuFollow().MoveAll(fromUID, toUID)
}

// DeleteJoyuAccountData 刪除帳號：刪掉這個 uid 的全部追蹤；Firebase 帳號由前端呼叫 user.delete() 刪
func DeleteJoyuAccountData(uid string) error {
	return avRepo.NewJoyuFollow().DeleteByUID(uid)
}
