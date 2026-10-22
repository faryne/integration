package mcp

import (
	"context"
	"maps"
	"slices"

	"faryne.dev/model/entity"
	ratesEntity "faryne.dev/model/entity/opendata/rates"
	ratesService "faryne.dev/service/rates"
)

type ratesQueryArguments struct {
	Bank       string   `json:"bank"`
	Currencies []string `json:"currencies"`
	BeginDate  string   `json:"begin_date"`
	EndDate    string   `json:"end_date"`
}

func (s *Server) registerRatesTools() {
	s.registerRatesToolsWithQuery(ratesService.Query)
}

// registerRatesToolsWithQuery 讓 MCP 參數轉換可獨立測試，不必連 DB
func (s *Server) registerRatesToolsWithQuery(query func(ratesEntity.RateRequest) (*ratesEntity.RateQueryResult, error)) {
	_ = s.RegisterTool(Tool{
		Name: "exchange_rates_query",
		Description: "Query daily cash exchange rates (foreign currency to TWD) posted by Taiwan banks, as shown on faryne.dev/data/rates. " +
			"Each row: base = foreign currency, to = TWD, buy_rate = price the bank pays for 1 unit of foreign cash, " +
			"sell_rate = price the bank charges for 1 unit of foreign cash. " +
			"Defaults to the last 7 days; the range may not exceed 93 days. Taiwan Bank (BOT) has historical data only.",
		InputSchema: objectSchema(map[string]interface{}{
			"bank":       stringEnumSchema("Optional bank service_name; omit to query all banks.", slices.Sorted(maps.Keys(ratesService.Banks))...),
			"currencies": stringArraySchema("Optional ISO 4217 currency codes, for example USD or JPY."),
			"begin_date": stringSchema("Optional first date, inclusive, YYYY-MM-DD. Defaults to 6 days before end_date."),
			"end_date":   stringSchema("Optional last date, inclusive, YYYY-MM-DD. Defaults to today (Asia/Taipei)."),
		}, nil),
		Handler: func(ctx context.Context, arguments map[string]interface{}) (*CallToolResult, error) {
			var args ratesQueryArguments
			if err := decodeArguments(arguments, &args); err != nil {
				return nil, err
			}
			begin, err := parseOptionalDate(args.BeginDate)
			if err != nil {
				return nil, err
			}
			end, err := parseOptionalDate(args.EndDate)
			if err != nil {
				return nil, err
			}
			result, err := query(ratesEntity.RateRequest{ServiceName: args.Bank, Currencies: args.Currencies, BeginDate: begin, EndDate: end})
			if err != nil {
				return nil, err
			}
			return jsonTextResult(result)
		},
	})
}

// parseOptionalDate 空字串代表沒給，回零值交給 service 補預設
func parseOptionalDate(value string) (entity.OnlyDateFormat, error) {
	if value == "" {
		return entity.OnlyDateFormat{}, nil
	}
	return parseOnlyDate(value)
}
