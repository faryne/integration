package mcp

import (
	"context"
	"testing"

	"faryne.dev/service/twstats"
	"github.com/stretchr/testify/require"
)

type fakeTWStatsService struct {
	keyword  string
	page     int
	perPage  int
	retrieve twstats.RetrieveRequest
}

func (s *fakeTWStatsService) Search(_ context.Context, keyword string, page, perPage int) (*twstats.SearchResult, error) {
	s.keyword, s.page, s.perPage = keyword, page, perPage
	return &twstats.SearchResult{Total: 1, Page: page, PerPage: perPage, Data: []twstats.Indicator{{Name: "人口密度"}}}, nil
}

func (s *fakeTWStatsService) Retrieve(_ context.Context, input twstats.RetrieveRequest) (*twstats.RetrieveResult, error) {
	s.retrieve = input
	return &twstats.RetrieveResult{Name: input.Name}, nil
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
}
