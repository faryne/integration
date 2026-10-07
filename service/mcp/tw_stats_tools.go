package mcp

import (
	"context"

	"faryne.dev/service/twstats"
)

type twStatsService interface {
	Search(context.Context, string, int, int) (*twstats.SearchResult, error)
	Retrieve(context.Context, twstats.RetrieveRequest) (*twstats.RetrieveResult, error)
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

func (s *Server) registerTWStatsTools() {
	s.registerTWStatsToolsWithService(twstats.NewService())
}

// registerTWStatsToolsWithService 讓 MCP adapter 的參數映射可獨立測試，不需連 GitHub raw content。
func (s *Server) registerTWStatsToolsWithService(service twStatsService) {
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

func integerListSchema(description string) map[string]interface{} {
	return map[string]interface{}{
		"type":        "array",
		"description": description,
		"items":       map[string]interface{}{"type": "integer", "minimum": 1},
		"minItems":    1,
	}
}
