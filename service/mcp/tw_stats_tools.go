package mcp

import (
	"context"
	"sort"
	"strings"

	model "faryne.dev/model/entity/opendata/twstats"
	"faryne.dev/service/twstats"
)

type twStatsService interface {
	Search(context.Context, string, int, int) (*twstats.SearchResult, error)
	Retrieve(context.Context, twstats.RetrieveRequest) (*twstats.RetrieveResult, error)
	Rank(context.Context, string, int) (*model.RankResult, error)
	AreaProfile(context.Context, string, model.AreaProfileRequest) (*model.AreaProfile, error)
	Movers(context.Context, model.MoversRequest) (*model.MoversResult, error)
	Correlate(context.Context, string, string, int) (*model.CorrelationResult, error)
}

type twStatsSearchArguments struct {
	Keyword string `json:"keyword"`
	Page    int    `json:"page"`
	PerPage int    `json:"per_page"`
}

type twStatsRetrieveArguments struct {
	Name      string   `json:"name"`
	StartYear int      `json:"start_year"`
	EndYear   int      `json:"end_year"`
	Years     []int    `json:"years"`
	Areas     []string `json:"areas"`
}

type twStatsRankArguments struct {
	Name string `json:"name"`
	Year int    `json:"year"`
}

type twStatsAreaProfileArguments struct {
	Area     string `json:"area"`
	Year     int    `json:"year"`
	Category string `json:"category"`
	Limit    int    `json:"limit"`
}

type twStatsMoversArguments struct {
	Year     int    `json:"year"`
	Area     string `json:"area"`
	Category string `json:"category"`
	Limit    int    `json:"limit"`
}

type twStatsCorrelateArguments struct {
	X    string `json:"x"`
	Y    string `json:"y"`
	Year int    `json:"year"`
}

// twStatsAreaHighlights 縣市健檢全量約 600 列太佔 context，MCP 只回名次最前與最後的 N 項
type twStatsAreaHighlights struct {
	Area     model.Area            `json:"area"`
	Total    int                   `json:"total"`
	Highest  []model.AreaIndicator `json:"highest"`
	Lowest   []model.AreaIndicator `json:"lowest"`
	PageURL  string                `json:"page_url"`
	Category string                `json:"category,omitempty"`
}

const defaultTWStatsAreaLimit = 15

func (s *Server) registerTWStatsTools() {
	s.registerTWStatsToolsWithService(twstats.Default)
}

// registerTWStatsToolsWithService 讓 MCP adapter 的參數映射可獨立測試，不需連 GitHub raw content。
func (s *Server) registerTWStatsToolsWithService(service twStatsService) {
	s.registerTWStatsAnalysisTools(service)
	_ = s.RegisterTool(Tool{
		Name:        "tw_stats_search",
		Description: "Search the Taiwan public statistics indicators listed on faryne.dev/data/tw-stats.",
		InputSchema: objectSchema(map[string]interface{}{
			"keyword":  stringSchema("Optional keyword matched against the indicator key and Traditional Chinese name."),
			"page":     integerMinimumSchema("Page number, defaults to 1.", 1),
			"per_page": integerRangeSchema("Results per page, defaults to 30.", 1, 100),
		}, nil),
		Handler: func(ctx context.Context, arguments map[string]interface{}) (*CallToolResult, error) {
			var args twStatsSearchArguments
			if err := decodeArguments(arguments, &args); err != nil {
				return nil, err
			}
			result, err := service.Search(ctx, args.Keyword, args.Page, args.PerPage)
			if err != nil {
				return nil, err
			}
			return jsonTextResult(result)
		},
	})

	_ = s.RegisterTool(Tool{
		Name:        "tw_stats_retrieve",
		Description: "Retrieve one Taiwan public statistics indicator, optionally filtered by year range and areas.",
		InputSchema: objectSchema(map[string]interface{}{
			"name":       stringSchema("Exact Traditional Chinese indicator name returned by tw_stats_search."),
			"start_year": integerMinimumSchema("Optional first year, inclusive.", 1),
			"end_year":   integerMinimumSchema("Optional last year, inclusive.", 1),
			"years":      integerListSchema("Optional exact years. When combined with a range, both filters apply."),
			"areas":      stringArraySchema("Optional Taiwan area codes or Chinese names, for example Taiwan, Taipei, 台灣, or 台北市."),
		}, []string{"name"}),
		Handler: func(ctx context.Context, arguments map[string]interface{}) (*CallToolResult, error) {
			var args twStatsRetrieveArguments
			if err := decodeArguments(arguments, &args); err != nil {
				return nil, err
			}
			result, err := service.Retrieve(ctx, twstats.RetrieveRequest{
				Name: args.Name, StartYear: args.StartYear, EndYear: args.EndYear, Years: args.Years, Areas: args.Areas,
			})
			if err != nil {
				return nil, err
			}
			return jsonTextResult(result)
		},
	})
}

func (s *Server) registerTWStatsAnalysisTools(service twStatsService) {
	categoryDescription := "Optional indicator category: " + strings.Join(twstats.CategoryIDs(), ", ") + "."
	_ = s.RegisterTool(Tool{
		Name:        "tw_stats_rank",
		Description: "Rank Taiwan's 22 counties for one indicator in one year. Count-type indicators are ranked by value per 10,000 residents.",
		InputSchema: objectSchema(map[string]interface{}{
			"name": stringSchema("Exact Traditional Chinese indicator name returned by tw_stats_search."),
			"year": integerMinimumSchema("Optional year, defaults to the indicator's latest year.", 1),
		}, []string{"name"}),
		Handler: func(ctx context.Context, arguments map[string]interface{}) (*CallToolResult, error) {
			var args twStatsRankArguments
			if err := decodeArguments(arguments, &args); err != nil {
				return nil, err
			}
			result, err := service.Rank(ctx, args.Name, args.Year)
			if err != nil {
				return nil, err
			}
			return jsonTextResult(result)
		},
	})

	_ = s.RegisterTool(Tool{
		Name:        "tw_stats_area_profile",
		Description: "Profile one Taiwan county: the indicators where it ranks highest and lowest among the 22 counties, with values and year-over-year change. Higher rank means a higher value, not a better outcome.",
		InputSchema: objectSchema(map[string]interface{}{
			"area":     stringSchema("County code or Chinese name, for example Taipei or 台北市. Taiwan (national total) is not allowed."),
			"year":     integerMinimumSchema("Optional year. Omit to use each indicator's latest year for this county.", 1),
			"category": stringEnumSchema(categoryDescription, twstats.CategoryIDs()...),
			"limit":    integerRangeSchema("Number of highest and lowest indicators to return, defaults to 15.", 1, 50),
		}, []string{"area"}),
		Handler: func(ctx context.Context, arguments map[string]interface{}) (*CallToolResult, error) {
			var args twStatsAreaProfileArguments
			if err := decodeArguments(arguments, &args); err != nil {
				return nil, err
			}
			profile, err := service.AreaProfile(ctx, args.Area, model.AreaProfileRequest{Year: args.Year, Category: args.Category})
			if err != nil {
				return nil, err
			}
			return jsonTextResult(areaHighlights(profile, args.Category, args.Limit))
		},
	})

	_ = s.RegisterTool(Tool{
		Name:        "tw_stats_movers",
		Description: "List the biggest year-over-year changes: national indicators by change rate, and counties by change in rank among the 22 counties.",
		InputSchema: objectSchema(map[string]interface{}{
			"year":     integerMinimumSchema("Optional year compared with the previous year, defaults to the latest year most indicators have.", 1),
			"area":     stringSchema("Optional county code or Chinese name to only list that county's rank changes."),
			"category": stringEnumSchema(categoryDescription, twstats.CategoryIDs()...),
			"limit":    integerRangeSchema("Rows per list, defaults to 50.", 1, 200),
		}, nil),
		Handler: func(ctx context.Context, arguments map[string]interface{}) (*CallToolResult, error) {
			var args twStatsMoversArguments
			if err := decodeArguments(arguments, &args); err != nil {
				return nil, err
			}
			result, err := service.Movers(ctx, model.MoversRequest{Year: args.Year, Area: args.Area, Category: args.Category, Limit: args.Limit})
			if err != nil {
				return nil, err
			}
			return jsonTextResult(result)
		},
	})

	_ = s.RegisterTool(Tool{
		Name:        "tw_stats_correlate",
		Description: "Pearson correlation between two indicators across Taiwan's 22 counties in one year. Count-type indicators use values per 10,000 residents. With only 22 samples and many indicators driven by urbanization, correlation does not imply causation.",
		InputSchema: objectSchema(map[string]interface{}{
			"x":    stringSchema("First indicator name."),
			"y":    stringSchema("Second indicator name."),
			"year": integerMinimumSchema("Optional year, defaults to the latest year both indicators have.", 1),
		}, []string{"x", "y"}),
		Handler: func(ctx context.Context, arguments map[string]interface{}) (*CallToolResult, error) {
			var args twStatsCorrelateArguments
			if err := decodeArguments(arguments, &args); err != nil {
				return nil, err
			}
			result, err := service.Correlate(ctx, args.X, args.Y, args.Year)
			if err != nil {
				return nil, err
			}
			return jsonTextResult(result)
		},
	})
}

// areaHighlights 依「名次／有資料縣市數」排序，取最前與最後各 limit 項
func areaHighlights(profile *model.AreaProfile, category string, limit int) twStatsAreaHighlights {
	if limit == 0 {
		limit = defaultTWStatsAreaLimit
	}
	rows := append([]model.AreaIndicator(nil), profile.Indicators...)
	sort.SliceStable(rows, func(i, j int) bool {
		return float64(rows[i].Rank)/float64(rows[i].RankTotal) < float64(rows[j].Rank)/float64(rows[j].RankTotal)
	})
	n := min(limit, len(rows))
	lowest := append([]model.AreaIndicator(nil), rows[len(rows)-n:]...)
	for i, j := 0, len(lowest)-1; i < j; i, j = i+1, j-1 {
		lowest[i], lowest[j] = lowest[j], lowest[i]
	}
	return twStatsAreaHighlights{
		Area: profile.Area, Total: len(rows), Highest: rows[:n], Lowest: lowest, Category: category,
		PageURL: "https://faryne.dev/data/tw-stats/area/" + profile.Area.Code,
	}
}

func integerListSchema(description string) map[string]interface{} {
	return map[string]interface{}{
		"type":        "array",
		"description": description,
		"items":       map[string]interface{}{"type": "integer", "minimum": 1},
		"minItems":    1,
	}
}
