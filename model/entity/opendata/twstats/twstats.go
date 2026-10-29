package twstats

import "time"

// Area 縣市代碼與中文名稱；代碼沿用 tw-stats 原始資料的欄位名（Taiwan、Taipei...）
type Area struct {
	Code string `json:"code"`
	Name string `json:"name"`
}

// IndicatorRef 指標的識別資訊；PerCapita 表示排名時以每萬人換算值比較
type IndicatorRef struct {
	Key       string `json:"key"`
	Name      string `json:"name"`
	Unit      string `json:"unit"`
	Category  string `json:"category"`
	PerCapita bool   `json:"per_capita"`
}

type AreaProfileRequest struct {
	Year     int    `query:"year"`     // 省略時各指標用該縣市最新有資料的年份
	Category string `query:"category"` // 省略時回傳全部分類
}

// AreaIndicator 縣市健檢的一列：某縣市在單一指標的數值、名次與年增率
type AreaIndicator struct {
	IndicatorRef
	Year           int      `json:"year"`
	Value          float64  `json:"value"`
	PerCapitaValue *float64 `json:"per_capita_value,omitempty"` // 每萬人換算值，只有數量類指標才有
	Rank           int      `json:"rank"`                       // 22 縣市中的名次（數值由高到低，同值同名次）
	RankTotal      int      `json:"rank_total"`                 // 該年有資料的縣市數
	ChangeRate     *float64 `json:"change_rate,omitempty"`      // 相較前一年的變化率（%），前一年缺值或為 0 時省略
}

type AreaProfile struct {
	Area       Area            `json:"area"`
	LoadedAt   time.Time       `json:"loaded_at"`
	Indicators []AreaIndicator `json:"indicators"`
}

type MoversRequest struct {
	Year     int    `query:"year"`     // 省略時用多數指標的最新年份
	Area     string `query:"area"`     // 只看單一縣市的名次變化
	Category string `query:"category"` // 只看單一分類
	Limit    int    `query:"limit"`    // 兩個榜各自的筆數上限
}

// NationalMover 全國榜：「台灣」數值的年增率
type NationalMover struct {
	IndicatorRef
	Value         float64 `json:"value"`
	PreviousValue float64 `json:"previous_value"`
	ChangeRate    float64 `json:"change_rate"`
}

// CountyMover 縣市榜：以名次變化排序，避免小縣市基數小、年增率動輒數倍而洗版
type CountyMover struct {
	IndicatorRef
	Area           Area     `json:"area"`
	Value          float64  `json:"value"`
	PerCapitaValue *float64 `json:"per_capita_value,omitempty"`
	Rank           int      `json:"rank"`
	PreviousRank   int      `json:"previous_rank"`
	RankChange     int      `json:"rank_change"` // 正數＝名次往前（數值相對變高）
	ChangeRate     *float64 `json:"change_rate,omitempty"`
}

type MoversResult struct {
	Year     int             `json:"year"`
	National []NationalMover `json:"national"`
	Counties []CountyMover   `json:"counties"`
}

type RankEntry struct {
	Area           Area     `json:"area"`
	Value          float64  `json:"value"`
	PerCapitaValue *float64 `json:"per_capita_value,omitempty"`
	Rank           int      `json:"rank"`
}

// RankResult 單一指標某年的 22 縣市排名；Taiwan 為全國彙總值
type RankResult struct {
	IndicatorRef
	Year    int         `json:"year"`
	Taiwan  *float64    `json:"taiwan,omitempty"`
	Entries []RankEntry `json:"entries"`
}

type CorrelationPoint struct {
	Area Area    `json:"area"`
	X    float64 `json:"x"`
	Y    float64 `json:"y"`
}

// CorrelationResult 兩指標在同一年 22 縣市間的皮爾森相關係數；數量類指標以每萬人換算值計算
type CorrelationResult struct {
	X           IndicatorRef       `json:"x"`
	Y           IndicatorRef       `json:"y"`
	Year        int                `json:"year"`
	Coefficient float64            `json:"coefficient"`
	Points      []CorrelationPoint `json:"points"`
}
