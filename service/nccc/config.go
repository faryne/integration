package nccc

import "sort"

const (
	baseURL       = "https://www.nccc.com.tw/dataDownload"
	s3DataPrefix  = "nccc/data"
	documentIDKey = "xxx"
)

var regions = []string{
	"TPE", "NTP", "TYC", "HCC", "HCH", "MLH", "TCC", "CHH", "NTH", "YUH", "CYH", "CYC",
	"TNC", "KHC", "PTH", "KLC", "YIH", "HLH", "TTH", "PHH", "KMH", "LCH",
}

var consumeTypes = []string{"FD", "CT", "LG", "TR", "EE", "DP", "OT"}

var chineseCities = []string{
	"台北市", "新北市", "桃園市", "新竹縣", "新竹市", "苗栗縣",
	"台中市", "彰化縣", "南投縣", "雲林縣", "嘉義縣", "嘉義市",
	"台南市", "高雄市", "屏東縣", "基隆市", "宜蘭縣", "花蓮縣",
	"台東縣", "澎湖縣", "金門縣", "連江縣",
}

var defaultPlaceholders = map[string][]string{
	"AREA":   regions,
	"TYPE":   consumeTypes,
	"GENDER": []string{"M", "F"},
}

var stringFieldNames = map[string]struct{}{
	"地區":     {},
	"類別":     {},
	"信用卡產業別": {},
	"年齡層":    {},
	"性別":     {},
	"教育程度":   {},
	"職業別":    {},
	"年收入":    {},
	"國家":     {},
	"年月":     {},
	"年度":     {},
	"id_key": {},
}

type dataSetConfig struct {
	URL  string
	Text string
}

var dataSets = map[string]dataSetConfig{
	"gender":            {URL: "/Gender/BANK_%{AREA}_%{TYPE}_GD.CSV", Text: "信用卡消費資料 - 兩性消費型態"},
	"age":               {URL: "/Age%20Group/BANK_%{AREA}_%{TYPE}_AG.CSV", Text: "信用卡消費資料 - 年齡層消費型態"},
	"income":            {URL: "/Annual%20Income/BANK_%{AREA}_%{TYPE}_AI.CSV", Text: "信用卡消費資料 - 年收入層消費型態"},
	"employment":        {URL: "/Classified%20Employment/BANK_%{AREA}_%{TYPE}_CE.CSV", Text: "信用卡消費資料 - 職業型態消費型態"},
	"education":         {URL: "/Education%20Level/BANK_%{AREA}_%{TYPE}_EL.CSV", Text: "信用卡消費資料 - 教育程度消費型態"},
	"cross_city":        {URL: "/DCR/BANK_%{AREA}_ALL_DCR.CSV", Text: "信用卡消費資料 - 跨縣市消費型態"},
	"cross_country":     {URL: "/ICR/BANK_%{AREA}_ALL_ICR.CSV", Text: "信用卡消費資料 - 跨境消費型態"},
	"ec":                {URL: "/EC/BANK_EC_%{TYPE}.CSV", Text: "信用卡消費資料 - 網路購物消費型態"},
	"foreign_1":         {URL: "/Country/BANK_%{AREA}_COUNTRY_NO.CSV", Text: "信用卡消費資料 - 前十大國外消費 依簽帳筆數"},
	"foreign_2":         {URL: "/Country/BANK_%{AREA}_COUNTRY_AMT.CSV", Text: "信用卡消費資料 - 前十大國外消費 依簽帳金額數"},
	"gender_ag":         {URL: "/Gender%20X%20Age%20Group/BANK_%{AREA}_FD_AG_%{GENDER}.CSV", Text: "性別Ｘ年齡層消費型態"},
	"gneder_ai":         {URL: "/Gender%20X%20Annual%20Income/BANK_%{AREA}_FD_AI_%{GENDER}.CSV", Text: "性別Ｘ年收入消費型態"},
	"gender_ce":         {URL: "/Gender%20X%20Classified%20Employment/BANK_%{AREA}_FD_CE_%{GENDER}.CSV", Text: "性別Ｘ職業別消費型態"},
	"gender_ee":         {URL: "/Gender%20X%20Education%20Level/BANK_%{AREA}_FD_EL_%{GENDER}.CSV", Text: "性別Ｘ教育程度消費型態"},
	"by_industry_total": {URL: "/NCCC%20Open%20Data/Industry/NCCC_TWN_%{TYPE}.CSV", Text: "各產業類別消費型態"},
	"by_region_total":   {URL: "/NCCC%20Open%20Data/Location/NCCC_%{AREA}.CSV", Text: "各地區消費型態"},
	"by_ec_total":       {URL: "/NCCC%20Open%20Data/Location%20EC/NCCC_TWN_EC.CSV", Text: "網路購物消費型態"},
}

func dataSetKeys() []string {
	keys := make([]string, 0, len(dataSets))
	for key := range dataSets {
		keys = append(keys, key)
	}
	sort.Strings(keys)
	return keys
}
