package av

import avEntity "faryne.dev/model/entity/opendata/av"

// 主題分組：總覽頁依 actressTopicGroups 的順序分區
const (
	topicGroupSpecial   = "special"
	topicGroupBody      = "body"
	topicGroupActive    = "active"
	topicGroupHoroscope = "horoscope"
	topicGroupBorn      = "born"
	topicGroupPref      = "pref"
	topicGroupHotGenre  = "hot"
	topicGroupColdGenre = "cold"
)

var actressTopicGroups = []struct{ Key, Label string }{
	{topicGroupSpecial, "特輯"},
	{topicGroupBody, "身材"},
	{topicGroupActive, "新人與活躍"},
	{topicGroupHoroscope, "星座"},
	{topicGroupBorn, "出生年代"},
	{topicGroupPref, "出身地"},
	{topicGroupHotGenre, "熱門類型"},
	{topicGroupColdGenre, "冷門類型"},
}

// 主題頁的預設排序（前端排序方式的 key）
const (
	topicSortVideos = "videos"
	topicSortRecent = "recent"
	topicSortGenre  = "genre"
	topicSortDebut  = "debut"
)

const (
	// topicMinMembers 出生年代、出身地人數少於這個數就不開頁
	topicMinMembers     = 30
	topicNewcomerMonths = 12
	topicActiveMonths   = 6
)

// horoscopeSign 西洋星座（日本通用的日期區間）；摩羯座跨年，From 在 12 月、To 在 1 月
type horoscopeSign struct {
	Slug, Label                        string
	FromMonth, FromDay, ToMonth, ToDay int
}

var horoscopeSigns = []horoscopeSign{
	{"aries", "牡羊座", 3, 21, 4, 19},
	{"taurus", "金牛座", 4, 20, 5, 20},
	{"gemini", "雙子座", 5, 21, 6, 21},
	{"cancer", "巨蟹座", 6, 22, 7, 22},
	{"leo", "獅子座", 7, 23, 8, 22},
	{"virgo", "處女座", 8, 23, 9, 22},
	{"libra", "天秤座", 9, 23, 10, 23},
	{"scorpio", "天蠍座", 10, 24, 11, 22},
	{"sagittarius", "射手座", 11, 23, 12, 21},
	{"capricorn", "摩羯座", 12, 22, 1, 19},
	{"aquarius", "水瓶座", 1, 20, 2, 18},
	{"pisces", "雙魚座", 2, 19, 3, 20},
}

// horoscopeOf 依生日月日算星座 slug。沒有月日回空字串；
// 11/30 也回空字串：xcity 只知道出生年時會填 11/30（342 位，一般日期約 40 位），不排除的話射手座會多出一倍
func horoscopeOf(month, day int) string {
	if month < 1 || month > 12 || day < 1 || day > 31 || (month == 11 && day == 30) {
		return ""
	}
	for _, s := range horoscopeSigns {
		if (month == s.FromMonth && day >= s.FromDay) || (month == s.ToMonth && day <= s.ToDay) {
			return s.Slug
		}
	}
	return ""
}

// prefectures 都道府県 → 網址 slug（出身地主題 pref-<slug>）；born_city 不在這裡的值（海外等）不開頁
var prefectures = map[string]string{
	"北海道": "hokkaido", "青森県": "aomori", "岩手県": "iwate", "宮城県": "miyagi", "秋田県": "akita", "山形県": "yamagata", "福島県": "fukushima",
	"茨城県": "ibaraki", "栃木県": "tochigi", "群馬県": "gunma", "埼玉県": "saitama", "千葉県": "chiba", "東京都": "tokyo", "神奈川県": "kanagawa",
	"新潟県": "niigata", "富山県": "toyama", "石川県": "ishikawa", "福井県": "fukui", "山梨県": "yamanashi", "長野県": "nagano", "岐阜県": "gifu",
	"静岡県": "shizuoka", "愛知県": "aichi", "三重県": "mie", "滋賀県": "shiga", "京都府": "kyoto", "大阪府": "osaka", "兵庫県": "hyogo",
	"奈良県": "nara", "和歌山県": "wakayama", "鳥取県": "tottori", "島根県": "shimane", "岡山県": "okayama", "広島県": "hiroshima", "山口県": "yamaguchi",
	"徳島県": "tokushima", "香川県": "kagawa", "愛媛県": "ehime", "高知県": "kochi", "福岡県": "fukuoka", "佐賀県": "saga", "長崎県": "nagasaki",
	"熊本県": "kumamoto", "大分県": "oita", "宮崎県": "miyazaki", "鹿児島県": "kagoshima", "沖縄県": "okinawa",
}

// actressTopicDef 自訂主題（身材、特輯）。第 1、2 階段寫在程式裡，第 3 階段改從 DB 讀，條件結構相同
type actressTopicDef struct {
	Slug, Label, Group, DefaultSort string
	Conditions                      avEntity.ActressTopicConditions
}

// bodyTopicDefs 身材形容詞主題；門檻是 2026-10-31 用 prod 資料試算後抓的，第 3 階段可以在管理介面調整
var bodyTopicDefs = []actressTopicDef{
	{"petite", "嬌小", topicGroupBody, topicSortVideos, avEntity.ActressTopicConditions{Height: [2]int{0, 150}}},
	{"tall", "高挑", topicGroupBody, topicSortVideos, avEntity.ActressTopicConditions{Height: [2]int{168, 0}}},
	{"small-breasts", "微乳", topicGroupBody, topicSortVideos, avEntity.ActressTopicConditions{Cup: [2]string{"A", "B"}}},
	{"shapely-breasts", "美乳", topicGroupBody, topicSortVideos, avEntity.ActressTopicConditions{Cup: [2]string{"C", "D"}, Waist: [2]int{0, 58}}},
	{"big-breasts", "巨乳", topicGroupBody, topicSortVideos, avEntity.ActressTopicConditions{Cup: [2]string{"E", "G"}}},
	{"huge-breasts", "爆乳", topicGroupBody, topicSortVideos, avEntity.ActressTopicConditions{Cup: [2]string{"H", "I"}}},
	{"giant-breasts", "超乳", topicGroupBody, topicSortVideos, avEntity.ActressTopicConditions{Cup: [2]string{"J", ""}}},
	{"marshmallow", "棉花糖", topicGroupBody, topicSortVideos, avEntity.ActressTopicConditions{Cup: [2]string{"F", ""}, Hips: [2]int{90, 0}}},
	{"petite-busty", "嬌小巨乳", topicGroupBody, topicSortVideos, avEntity.ActressTopicConditions{Height: [2]int{0, 152}, Cup: [2]string{"F", ""}}},
	{"model-figure", "模特兒身材", topicGroupBody, topicSortVideos, avEntity.ActressTopicConditions{Height: [2]int{165, 0}, Waist: [2]int{0, 58}}},
	{"peach-hips", "蜜桃臀", topicGroupBody, topicSortVideos, avEntity.ActressTopicConditions{Hips: [2]int{92, 0}, Waist: [2]int{0, 60}}},
	{"slim-waist", "細腰", topicGroupBody, topicSortVideos, avEntity.ActressTopicConditions{HipWaistDiff: [2]int{32, 0}}},
}
