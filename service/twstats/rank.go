package twstats

import (
	"context"
	"errors"
	"fmt"
	"math"
	"sort"
	"strings"

	model "faryne.dev/model/entity/opendata/twstats"
)

func (d *indicatorData) ref() model.IndicatorRef {
	return model.IndicatorRef{Key: d.Key, Name: d.Name, Unit: d.Unit, Category: d.Category, PerCapita: d.PerCapita}
}

// perCapitaValue 只有數量類指標才回傳每萬人換算值，其餘為 nil
func (c *Cube) perCapitaValue(d *indicatorData, year, column int) *float64 {
	if !d.PerCapita {
		return nil
	}
	if value, ok := c.rankValue(d, year, column); ok {
		return &value
	}
	return nil
}

// changeRate 相較前一年的變化率（%）；前一年缺值或為 0 時回傳 nil
func changeRate(d *indicatorData, year, column int) *float64 {
	current, ok := d.value(year, column)
	previous, prevOK := d.value(year-1, column)
	if !ok || !prevOK || previous == 0 {
		return nil
	}
	rate := (current - previous) / math.Abs(previous) * 100
	return &rate
}

// resolveCounty 驗證縣市代碼或中文名稱；「台灣」是全國彙總、不參與排名，因此排除
func resolveCounty(value string) (Area, int, error) {
	resolved, err := resolveAreas([]string{value})
	if err != nil {
		return Area{}, 0, err
	}
	if resolved[0].Code == "Taiwan" {
		return Area{}, 0, errors.New("area must be a county, not Taiwan")
	}
	return resolved[0], columnOf(resolved[0].Code), nil
}

func validateCategory(category string) error {
	if category != "" && !isCategory(category) {
		return fmt.Errorf("unsupported category: %s", category)
	}
	return nil
}

// Rank 單一指標某年的 22 縣市排名；year 省略時用該指標最新年份
func (s *Service) Rank(_ context.Context, name string, year int) (*model.RankResult, error) {
	cube, err := s.loadedCube()
	if err != nil {
		return nil, err
	}
	data, ok := cube.byName[strings.TrimSpace(name)]
	if !ok {
		return nil, ErrIndicatorNotFound
	}
	if year == 0 {
		year = data.Years[len(data.Years)-1]
	}
	if _, ok := data.Rows[year]; !ok {
		return nil, fmt.Errorf("%s has no data in %d", data.Name, year)
	}

	result := &model.RankResult{IndicatorRef: data.ref(), Year: year}
	if value, ok := data.value(year, 0); ok {
		result.Taiwan = &value
	}
	for column, rank := range cube.countyRanks(data, year) {
		value, _ := data.value(year, column)
		result.Entries = append(result.Entries, model.RankEntry{
			Area: areas[column], Value: value, PerCapitaValue: cube.perCapitaValue(data, year, column), Rank: rank,
		})
	}
	sort.Slice(result.Entries, func(i, j int) bool { return result.Entries[i].Rank < result.Entries[j].Rank })
	return result, nil
}

// AreaProfile 縣市健檢：該縣市在每個指標的數值、22 縣市名次與年增率。
// year 省略時各指標各自用該縣市最新有資料的年份（各指標更新進度不一）；指定年份時沒有該年資料的指標不列入。
func (s *Service) AreaProfile(_ context.Context, areaValue string, req model.AreaProfileRequest) (*model.AreaProfile, error) {
	if err := validateCategory(req.Category); err != nil {
		return nil, err
	}
	area, column, err := resolveCounty(areaValue)
	if err != nil {
		return nil, err
	}
	cube, err := s.loadedCube()
	if err != nil {
		return nil, err
	}

	result := &model.AreaProfile{Area: area, LoadedAt: cube.LoadedAt, Indicators: []model.AreaIndicator{}}
	for _, data := range cube.indicators {
		if req.Category != "" && data.Category != req.Category {
			continue
		}
		year := req.Year
		if year == 0 {
			year = latestYearOf(data, column)
		}
		value, ok := data.value(year, column)
		if !ok {
			continue
		}
		ranks := cube.countyRanks(data, year)
		rank, ok := ranks[column]
		if !ok {
			continue
		}
		result.Indicators = append(result.Indicators, model.AreaIndicator{
			IndicatorRef: data.ref(), Year: year, Value: value,
			PerCapitaValue: cube.perCapitaValue(data, year, column),
			Rank:           rank, RankTotal: len(ranks), ChangeRate: changeRate(data, year, column),
		})
	}
	return result, nil
}

// latestYearOf 指定欄位最新有資料的年份，全無資料時回傳 0
func latestYearOf(data *indicatorData, column int) int {
	for i := len(data.Years) - 1; i >= 0; i-- {
		if _, ok := data.value(data.Years[i], column); ok {
			return data.Years[i]
		}
	}
	return 0
}
