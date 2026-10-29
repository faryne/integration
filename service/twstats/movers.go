package twstats

import (
	"context"
	"fmt"
	"math"
	"sort"
	"strings"

	model "faryne.dev/model/entity/opendata/twstats"
)

const (
	defaultMoversLimit = 50
	maxMoversLimit     = 200
	minCorrelationArea = 3
)

// volatileCounties 金門、連江人口少（約 14 萬、1.4 萬），實測名次常整段 22↔1 跳動、洗版縣市榜；
// 未指定縣市時不列入，指定查詢這兩縣時照常列出
var volatileCounties = map[string]bool{"Kinmen": true, "Matsu": true}

// Movers 年度變化榜。全國榜以「台灣」年增率排序；縣市榜以名次變化排序（同名次變化再比年增率），
// 不用年增率是因為小縣市基數小（例如 3 件變 9 件就是 +200%），會整個洗版。
func (s *Service) Movers(_ context.Context, req model.MoversRequest) (*model.MoversResult, error) {
	if err := validateCategory(req.Category); err != nil {
		return nil, err
	}
	if req.Limit < 0 || req.Limit > maxMoversLimit {
		return nil, fmt.Errorf("limit must be between 1 and %d", maxMoversLimit)
	}
	if req.Limit == 0 {
		req.Limit = defaultMoversLimit
	}
	areaColumn := 0
	if strings.TrimSpace(req.Area) != "" {
		_, column, err := resolveCounty(req.Area)
		if err != nil {
			return nil, err
		}
		areaColumn = column
	}
	cube, err := s.loadedCube()
	if err != nil {
		return nil, err
	}
	year := req.Year
	if year == 0 {
		year = cube.latestYear
	}

	result := &model.MoversResult{Year: year, LatestYear: cube.latestYear, National: []model.NationalMover{}, Counties: []model.CountyMover{}}
	for _, data := range cube.indicators {
		if req.Category != "" && data.Category != req.Category {
			continue
		}
		if rate := changeRate(data, year, 0); rate != nil {
			value, _ := data.value(year, 0)
			previous, _ := data.value(year-1, 0)
			result.National = append(result.National, model.NationalMover{
				IndicatorRef: data.ref(), Value: value, PreviousValue: previous, ChangeRate: *rate,
			})
		}
		ranks, previousRanks := cube.countyRanks(data, year), cube.countyRanks(data, year-1)
		for column, rank := range ranks {
			previousRank, ok := previousRanks[column]
			if !ok || rank == previousRank || areaColumn != 0 && column != areaColumn || areaColumn == 0 && volatileCounties[areas[column].Code] {
				continue
			}
			value, _ := data.value(year, column)
			result.Counties = append(result.Counties, model.CountyMover{
				IndicatorRef: data.ref(), Area: areas[column], Value: value,
				PerCapitaValue: cube.perCapitaValue(data, year, column),
				Rank:           rank, PreviousRank: previousRank, RankChange: previousRank - rank,
				ChangeRate: changeRate(data, year, column),
			})
		}
	}

	sort.Slice(result.National, func(i, j int) bool {
		return math.Abs(result.National[i].ChangeRate) > math.Abs(result.National[j].ChangeRate)
	})
	sort.Slice(result.Counties, func(i, j int) bool {
		a, b := result.Counties[i], result.Counties[j]
		if absInt(a.RankChange) != absInt(b.RankChange) {
			return absInt(a.RankChange) > absInt(b.RankChange)
		}
		return rateMagnitude(a.ChangeRate) > rateMagnitude(b.ChangeRate)
	})
	result.National = result.National[:min(req.Limit, len(result.National))]
	result.Counties = result.Counties[:min(req.Limit, len(result.Counties))]
	return result, nil
}

func absInt(value int) int {
	if value < 0 {
		return -value
	}
	return value
}

func rateMagnitude(rate *float64) float64 {
	if rate == nil {
		return 0
	}
	return math.Abs(*rate)
}

// Correlate 兩指標在同一年 22 縣市間的皮爾森相關係數；year 省略時用兩者最新的共同年份。
// 注意：22 個縣市樣本小，且多數指標都與都市化程度相關，高相關不代表彼此有因果。
func (s *Service) Correlate(_ context.Context, nameX, nameY string, year int) (*model.CorrelationResult, error) {
	cube, err := s.loadedCube()
	if err != nil {
		return nil, err
	}
	x, okX := cube.byName[strings.TrimSpace(nameX)]
	y, okY := cube.byName[strings.TrimSpace(nameY)]
	if !okX || !okY {
		return nil, ErrIndicatorNotFound
	}
	if year == 0 {
		year = latestCommonYear(x, y)
	}

	result := &model.CorrelationResult{X: x.ref(), Y: y.ref(), Year: year, Points: []model.CorrelationPoint{}}
	for column := 1; column < totalColumn; column++ {
		valueX, okX := cube.rankValue(x, year, column)
		valueY, okY := cube.rankValue(y, year, column)
		if okX && okY {
			result.Points = append(result.Points, model.CorrelationPoint{Area: areas[column], X: valueX, Y: valueY})
		}
	}
	if len(result.Points) < minCorrelationArea {
		return nil, fmt.Errorf("not enough counties with data for both indicators in %d", year)
	}
	coefficient, ok := pearson(result.Points)
	if !ok {
		return nil, fmt.Errorf("one of the indicators has no variation across counties in %d", year)
	}
	result.Coefficient = coefficient
	return result, nil
}

func latestCommonYear(x, y *indicatorData) int {
	for i := len(x.Years) - 1; i >= 0; i-- {
		if _, ok := y.Rows[x.Years[i]]; ok {
			return x.Years[i]
		}
	}
	return 0
}

// pearson 任一變數變異數為 0（全部縣市同值）時無法計算，回傳 false
func pearson(points []model.CorrelationPoint) (float64, bool) {
	n := float64(len(points))
	var sumX, sumY float64
	for _, p := range points {
		sumX, sumY = sumX+p.X, sumY+p.Y
	}
	meanX, meanY := sumX/n, sumY/n
	var cov, varX, varY float64
	for _, p := range points {
		dx, dy := p.X-meanX, p.Y-meanY
		cov, varX, varY = cov+dx*dy, varX+dx*dx, varY+dy*dy
	}
	if varX == 0 || varY == 0 {
		return 0, false
	}
	return cov / math.Sqrt(varX*varY), true
}
