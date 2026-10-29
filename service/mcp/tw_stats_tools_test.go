package mcp

import (
	"context"
	"testing"

	model "faryne.dev/model/entity/opendata/twstats"
	"faryne.dev/service/twstats"
	"github.com/stretchr/testify/require"
)

type fakeTWStatsService struct {
	keyword  string
	page     int
	perPage  int
	retrieve twstats.RetrieveRequest
	area     string
	profile  model.AreaProfileRequest
	movers   model.MoversRequest
}

func (s *fakeTWStatsService) Search(_ context.Context, keyword string, page, perPage int) (*twstats.SearchResult, error) {
	s.keyword, s.page, s.perPage = keyword, page, perPage
	return &twstats.SearchResult{Total: 1, Page: page, PerPage: perPage, Data: []twstats.Indicator{{Name: "人口密度"}}}, nil
}

func (s *fakeTWStatsService) Retrieve(_ context.Context, input twstats.RetrieveRequest) (*twstats.RetrieveResult, error) {
	s.retrieve = input
	return &twstats.RetrieveResult{Name: input.Name}, nil
}

func (s *fakeTWStatsService) Rank(_ context.Context, name string, year int) (*model.RankResult, error) {
	return &model.RankResult{IndicatorRef: model.IndicatorRef{Name: name}, Year: year}, nil
}

// AreaProfile 回傳 4 項名次不同的指標，用來驗證 MCP 只取最前與最後各 limit 項
func (s *fakeTWStatsService) AreaProfile(_ context.Context, area string, req model.AreaProfileRequest) (*model.AreaProfile, error) {
	s.area, s.profile = area, req
	rows := make([]model.AreaIndicator, 0, 4)
	for i, rank := range []int{3, 1, 22, 10} {
		rows = append(rows, model.AreaIndicator{IndicatorRef: model.IndicatorRef{Key: string(rune('a' + i))}, Rank: rank, RankTotal: 22})
	}
	return &model.AreaProfile{Area: model.Area{Code: "Taipei", Name: "台北市"}, Indicators: rows}, nil
}

func (s *fakeTWStatsService) Movers(_ context.Context, req model.MoversRequest) (*model.MoversResult, error) {
	s.movers = req
	return &model.MoversResult{}, nil
}

func (s *fakeTWStatsService) Correlate(_ context.Context, x, y string, year int) (*model.CorrelationResult, error) {
	return &model.CorrelationResult{Year: year}, nil
}

func TestTWStatsAnalysisToolsMapArguments(t *testing.T) {
	service := &fakeTWStatsService{}
	server := newBareServer("test-server", "test-version")
	server.registerTWStatsToolsWithService(service)

	profile := callTool(t, server, "tw_stats_area_profile", map[string]interface{}{"area": "台北市", "category": "security", "limit": 1})
	require.False(t, profile.IsError)
	require.Equal(t, "台北市", service.area)
	require.Equal(t, model.AreaProfileRequest{Category: "security"}, service.profile)
	require.Contains(t, mustMarshal(t, profile), `\"highest\":[{\"key\":\"b\"`)
	require.Contains(t, mustMarshal(t, profile), `\"lowest\":[{\"key\":\"c\"`)

	movers := callTool(t, server, "tw_stats_movers", map[string]interface{}{"year": 2024, "area": "Taipei", "limit": 10})
	require.False(t, movers.IsError)
	require.Equal(t, model.MoversRequest{Year: 2024, Area: "Taipei", Limit: 10}, service.movers)
}

func TestTWStatsToolsMapArguments(t *testing.T) {
	service := &fakeTWStatsService{}
	server := newBareServer("test-server", "test-version")
	server.registerTWStatsToolsWithService(service)

	search := callTool(t, server, "tw_stats_search", map[string]interface{}{
		"keyword": "人口", "page": 2, "per_page": 10,
	})
	require.False(t, search.IsError)
	require.Equal(t, "人口", service.keyword)
	require.Equal(t, 2, service.page)
	require.Equal(t, 10, service.perPage)

	retrieve := callTool(t, server, "tw_stats_retrieve", map[string]interface{}{
		"name": "人口密度", "start_year": 2020, "end_year": 2024, "years": []int{2020, 2024}, "areas": []string{"台灣", "Taipei"},
	})
	require.False(t, retrieve.IsError)
	require.Equal(t, twstats.RetrieveRequest{
		Name: "人口密度", StartYear: 2020, EndYear: 2024, Years: []int{2020, 2024}, Areas: []string{"台灣", "Taipei"},
	}, service.retrieve)
}

func TestNewServerRegistersTWStatsTools(t *testing.T) {
	server := NewServer("test-server", "test-version")
	list, _, err := server.HandleJSONRPC(context.Background(), []byte(`{"jsonrpc":"2.0","id":1,"method":"tools/list"}`))
	require.NoError(t, err)
	body := mustMarshal(t, list.Result)
	require.Contains(t, body, `"name":"tw_stats_search"`)
	require.Contains(t, body, `"name":"tw_stats_retrieve"`)
	require.Contains(t, body, `"name":"tw_stats_area_profile"`)
	require.Contains(t, body, `"name":"tw_stats_movers"`)
}
