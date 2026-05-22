package twse

import (
	"fmt"
	"math"
	"time"

	"faryne.dev/model/entity/opendata/etf"
	repo "faryne.dev/repository/etf"
)

type ETFMonthlyPriceService struct {
	repo       *repo.RepositoryETFMonthlyPrice
	tickerRepo *repo.RepositoryETFTicker
	codeRepo   *repo.RepositoryETFCode
}

// NewETFMonthlyPriceService 建立一個新的 ETFMonthlyPriceService
func NewETFMonthlyPriceService() *ETFMonthlyPriceService {
	return &ETFMonthlyPriceService{
		repo:       repo.NewETFMonthlyPrice(),
		tickerRepo: repo.NewETFTicker(),
		codeRepo:   repo.NewETFCode(),
	}
}

// GetByYear 根據 ETF 代碼與年份獲取月均價資料
func (s *ETFMonthlyPriceService) GetByYear(code string, year int) ([]etf.MonthlyPrice, error) {
	return s.repo.GetByYear(code, year)
}

// UpdateMonthlyPriceByMonth 更新指定年月份的 ETF 月均價
// 如果 code 為空，則更新所有 ETF
func (s *ETFMonthlyPriceService) UpdateMonthlyPriceByMonth(year int, month int, code ...string) error {
	var targetCodes []string
	if len(code) > 0 && code[0] != "" {
		targetCodes = []string{code[0]}
	} else {
		// 獲取所有 ETF
		codes, err := s.codeRepo.GetAllETF()
		if err != nil {
			return err
		}
		for _, c := range codes {
			targetCodes = append(targetCodes, c.Code)
		}
	}

	startDate := fmt.Sprintf("%04d-%02d-01", year, month)
	// 下個月的第一天
	nextMonth := month + 1
	nextYear := year
	if nextMonth > 12 {
		nextMonth = 1
		nextYear++
	}
	endDate := fmt.Sprintf("%04d-%02d-01", nextYear, nextMonth)

	var toUpsert []etf.MonthlyPrice
	now := time.Now()

	for _, c := range targetCodes {
		tickers, err := s.tickerRepo.GetETFTickerByCodeAndDate(c, startDate, endDate)
		if err != nil {
			continue
		}

		// 過濾掉剛好等於 endDate 的數據（GetETFTickerByCodeAndDate 是包含兩端的）
		var validTickers []etf.Ticker
		for _, t := range tickers {
			if t.Date < endDate {
				validTickers = append(validTickers, t)
			}
		}

		if len(validTickers) == 0 {
			continue
		}

		var total float64
		for _, t := range validTickers {
			total += t.Close
		}
		avg := total / float64(len(validTickers))
		avg = math.Round(avg*10000) / 10000 // 保留四位小數

		toUpsert = append(toUpsert, etf.MonthlyPrice{
			Code:      c,
			Year:      year,
			Month:     month,
			AvgPrice:  avg,
			CreatedAt: now,
			UpdatedAt: now,
		})
	}

	return s.repo.UpsertBatch(toUpsert)
}

// UpdateAllMonthlyPrices 使用 GROUP BY 效率化更新指定 ETF 的所有歷史月均價
func (s *ETFMonthlyPriceService) UpdateAllMonthlyPrices(code ...string) error {
	if len(code) == 0 || code[0] == "" {
		return fmt.Errorf("code is required for UpdateAllMonthlyPrices")
	}
	targetCode := code[0]

	// 直接從 tickerRepo 取得所有月份的平均價
	averages, err := s.tickerRepo.GetMonthlyAverages(targetCode)
	if err != nil {
		return fmt.Errorf("failed to get monthly averages for %s: %v", targetCode, err)
	}

	if len(averages) == 0 {
		return nil
	}

	now := time.Now()
	// 上個月的年份和月份
	lastMonth := now.AddDate(0, -1, 0)
	endYear := lastMonth.Year()
	endMonth := int(lastMonth.Month())

	var toUpsert []etf.MonthlyPrice
	for _, avg := range averages {
		// 只處理到上個月為止的數據
		if avg.Year > endYear || (avg.Year == endYear && avg.Month > endMonth) {
			continue
		}

		avg.CreatedAt = now
		avg.UpdatedAt = now
		toUpsert = append(toUpsert, avg)
	}

	if len(toUpsert) == 0 {
		return nil
	}

	fmt.Printf("Batch updating %d monthly prices for %s...\n", len(toUpsert), targetCode)
	return s.repo.UpsertBatch(toUpsert)
}
