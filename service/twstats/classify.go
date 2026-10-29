package twstats

import (
	"regexp"
	"strconv"
)

// 本檔的分類與每萬人換算規則和前端 static_site/src/components/twstats/
// twStatsCategories.ts、twStatsPerCapita.ts 是同一份規則，修改時兩邊要一起改。

// populationIndicator 是每萬人換算的分母（單位：人）
const populationIndicator = "戶籍登記人口數"

type category struct {
	ID     string
	Label  string
	Ranges [][2]int // key 流水號閉區間，同一類可有多段
}

// categories：tw-stats 的 key 是主計總處「縣市重要統計指標」流水號，同類指標編號相鄰，直接以區段分類
var categories = []category{
	{"land", "土地", [][2]int{{-1, 5}}},
	{"population", "人口", [][2]int{{6, 152}}},
	{"labor", "勞動就業", [][2]int{{153, 176}, {476, 483}, {630, 631}}},
	{"civil", "公教與戶政", [][2]int{{177, 185}, {599, 604}}},
	{"security", "治安", [][2]int{{186, 216}}},
	{"safety", "交通事故與消防", [][2]int{{217, 241}}},
	{"welfare", "社會福利", [][2]int{{242, 310}}},
	{"education", "教育文化", [][2]int{{311, 356}}},
	{"agriculture", "農林漁牧", [][2]int{{357, 409}}},
	{"urban", "都市與交通", [][2]int{{410, 455}}},
	{"business", "工商觀光", [][2]int{{456, 475}}},
	{"finance", "財政", [][2]int{{484, 541}}},
	{"health", "醫療衛生", [][2]int{{542, 566}}},
	{"environment", "環境保護", [][2]int{{567, 598}}},
	{"household", "家庭收支", [][2]int{{605, 629}}},
}

// categoryOf 回傳 key 所屬分類 ID；落在所有區段外（未來新增的指標）回傳空字串
func categoryOf(key string) string {
	code, err := strconv.Atoi(key)
	if err != nil {
		return ""
	}
	for _, c := range categories {
		for _, r := range c.Ranges {
			if code >= r[0] && code <= r[1] {
				return c.ID
			}
		}
	}
	return ""
}

func isCategory(id string) bool {
	for _, c := range categories {
		if c.ID == id {
			return true
		}
	}
	return false
}

// countUnits：只有「數量／金額」類單位能換算每萬人；％、‰、人/十萬人等本身已是比率或密度的不換算
var countUnits = map[string]bool{
	"人": true, "千人": true, "人次": true, "戶": true, "對": true, "件": true, "千件": true, "次": true,
	"家": true, "家次": true, "所": true, "班": true, "個": true, "輛": true, "床": true, "具": true,
	"處": true, "間": true, "頭": true, "支": true, "時": true, "時段": true,
	"元": true, "千元": true, "百萬元": true, "公噸": true, "公頃": true, "公里": true,
	"平方公里": true, "平方公尺": true, "千平方公尺": true, "百萬度": true,
}

// 名稱已含平均／每／率（例如「每百戶擁有數」）的也排除，避免重複換算
var normalizedNamePattern = regexp.MustCompile(`平均|每|率`)

func canPerCapita(name, unit string) bool {
	return countUnits[unit] && name != populationIndicator && !normalizedNamePattern.MatchString(name)
}

// CategoryIDs 給 MCP 工具列舉可用分類
func CategoryIDs() []string {
	ids := make([]string, 0, len(categories))
	for _, c := range categories {
		ids = append(ids, c.ID)
	}
	return ids
}
