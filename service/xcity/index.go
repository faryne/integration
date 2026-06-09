package xcity

const baseUri = "https://xcity.jp/idol/"

// 跑資料只使用這幾組，不跑後面餘下的四個音（因為資料重複）
var syllabusKeys = []string{
	"a",
	"ka",
	"sa",
	"ta",
	"na",
	"ha",
	"ma",
	"ya",
	"ra",
	"wa",
}

var syllabus = map[string]string{
	"a":   "あ",
	"i":   "い",
	"u":   "う",
	"e":   "え",
	"o":   "お",
	"ka":  "か",
	"ki":  "き",
	"ku":  "く",
	"ke":  "け",
	"ko":  "こ",
	"sa":  "さ",
	"shi": "し",
	"su":  "す",
	"se":  "せ",
	"so":  "そ",
	"ta":  "た",
	"chi": "ち",
	"tsu": "つ",
	"te":  "て",
	"to":  "と",
	"na":  "な",
	"ni":  "に",
	"nu":  "ぬ",
	"ne":  "ね",
	"no":  "の",
	"ha":  "は",
	"hi":  "ひ",
	"fu":  "ふ",
	"he":  "へ",
	"ho":  "ほ",
	"ma":  "ま",
	"mi":  "み",
	"mu":  "む",
	"me":  "め",
	"mo":  "も",
	"ya":  "や",
	"yu":  "ゆ",
	"yo":  "よ",
	"ra":  "ら",
	"ri":  "り",
	"ru":  "る",
	"re":  "れ",
	"ro":  "ろ",
	"wa":  "わ",
}

func SyllabusKeys() []string {
	keys := make([]string, len(syllabusKeys))
	copy(keys, syllabusKeys)
	return keys
}
