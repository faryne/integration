package rates

import (
	"fmt"
	"strings"
	"time"

	"faryne.dev/model/entity"
	ratesEntity "faryne.dev/model/entity/opendata/rates"
	ratesRepository "faryne.dev/repository/rates"
)

const (
	defaultQueryDays = 7  // 沒給日期時查最近 7 天（含今天）
	maxQueryDays     = 93 // 一季左右；整張表三十幾萬筆，不讓外部一次撈完
)

// Query 給 MCP 等外部呼叫查匯率：補日期預設、限制區間後才查 DB
func Query(req ratesEntity.RateRequest) (*ratesEntity.RateQueryResult, error) {
	req, err := normalizeQuery(req, today())
	if err != nil {
		return nil, err
	}
	records, err := ratesRepository.FetchRates(req)
	if err != nil {
		return nil, err
	}
	return &ratesEntity.RateQueryResult{
		BeginDate: req.BeginDate.Time().Format(time.DateOnly),
		EndDate:   req.EndDate.Time().Format(time.DateOnly),
		Banks:     BankNames(),
		Rates:     records,
	}, nil
}

// normalizeQuery 檢查銀行代碼、幣別轉大寫，並補齊／檢查日期區間
func normalizeQuery(req ratesEntity.RateRequest, now time.Time) (ratesEntity.RateRequest, error) {
	if _, ok := Banks[req.ServiceName]; req.ServiceName != "" && !ok {
		return req, fmt.Errorf("unknown bank %q", req.ServiceName)
	}
	for i, c := range req.Currencies {
		req.Currencies[i] = strings.ToUpper(strings.TrimSpace(c))
	}

	begin, end := req.BeginDate.Time(), req.EndDate.Time()
	if end.IsZero() {
		end = time.Date(now.Year(), now.Month(), now.Day(), 0, 0, 0, 0, time.UTC)
	}
	if begin.IsZero() {
		begin = end.AddDate(0, 0, 1-defaultQueryDays)
	}
	switch days := int(end.Sub(begin).Hours()/24) + 1; {
	case days < 1:
		return req, fmt.Errorf("begin_date %s is after end_date %s", begin.Format(time.DateOnly), end.Format(time.DateOnly))
	case days > maxQueryDays:
		return req, fmt.Errorf("date range is %d days, at most %d days allowed", days, maxQueryDays)
	}
	req.BeginDate, req.EndDate = entity.OnlyDateFormat(begin), entity.OnlyDateFormat(end)
	return req, nil
}
