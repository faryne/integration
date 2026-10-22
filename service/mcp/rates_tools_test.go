package mcp

import (
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	ratesEntity "faryne.dev/model/entity/opendata/rates"
)

func TestRatesToolMapsArguments(t *testing.T) {
	var got ratesEntity.RateRequest
	server := newBareServer("test-server", "test-version")
	server.registerRatesToolsWithQuery(func(req ratesEntity.RateRequest) (*ratesEntity.RateQueryResult, error) {
		got = req
		return &ratesEntity.RateQueryResult{}, nil
	})

	result := callTool(t, server, "exchange_rates_query", map[string]interface{}{
		"bank": "esun", "currencies": []string{"USD"}, "begin_date": "2026-10-01", "end_date": "2026-10-22",
	})
	require.False(t, result.IsError)
	require.Equal(t, "esun", got.ServiceName)
	require.Equal(t, []string{"USD"}, got.Currencies)
	require.Equal(t, "2026-10-01", got.BeginDate.Time().Format(time.DateOnly))
	require.Equal(t, "2026-10-22", got.EndDate.Time().Format(time.DateOnly))

	// 沒給日期時保留零值，交給 service 補預設
	callTool(t, server, "exchange_rates_query", map[string]interface{}{})
	require.True(t, got.BeginDate.Time().IsZero())
	require.True(t, got.EndDate.Time().IsZero())

	bad := callTool(t, server, "exchange_rates_query", map[string]interface{}{"begin_date": "2026/10/01"})
	require.True(t, bad.IsError)
}
