package taipower

import "strings"

const (
	neighborPurposeRuleVersion = "1"
	purposeSocialAid           = "social_aid"
	purposeEducation           = "education"
	purposeCommunity           = "community"
	purposePublicFacilities    = "public_facilities"
	purposeEnergy              = "energy"
	purposeUnclassified        = "unclassified"
)

var purposeKeywords = []struct {
	key   string
	words []string
}{
	{purposeSocialAid, []string{"急難救助", "低收入", "中低收入", "弱勢", "清寒", "獨居老人", "身心障礙", "醫療補助", "喪葬補助"}},
	{purposeEducation, []string{"獎學金", "助學金", "教育活動", "學用品", "課後輔導", "校舍"}},
	{purposeCommunity, []string{"節慶", "廟會", "祭典", "聯誼", "藝文", "體育", "運動會", "文化季", "園遊會"}},
	{purposePublicFacilities, []string{"道路改善", "路燈", "公園整修", "活動中心修繕", "環境改善", "公共設施"}},
	{purposeEnergy, []string{"節約用電", "節能", "省電", "用電安全", "能源教育", "綠能宣導"}},
}

// classifyPurpose 只採明確用途詞；多類命中時留待分類，以免金額被錯誤歸因。
func classifyPurpose(summary string) string {
	matched := ""
	for _, category := range purposeKeywords {
		for _, word := range category.words {
			if !strings.Contains(summary, word) {
				continue
			}
			if matched != "" && matched != category.key {
				return purposeUnclassified
			}
			matched = category.key
			break
		}
	}
	if matched == "" {
		return purposeUnclassified
	}
	return matched
}

func validPurpose(key string) bool {
	switch key {
	case purposeSocialAid, purposeEducation, purposeCommunity, purposePublicFacilities, purposeEnergy, purposeUnclassified:
		return true
	default:
		return false
	}
}
