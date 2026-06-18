package nccc

import (
	"encoding/json"
	"testing"

	ncccModel "faryne.dev/model/entity/opendata/nccc"
	"faryne.dev/service/helper"
	"github.com/stretchr/testify/require"
)

func recordSearchRequest(page int64, perPage int64, cursor string) ncccModel.RecordSearchRequest {
	req := ncccModel.RecordSearchRequest{Cursor: cursor}
	req.Page = page
	req.PerPage = perPage
	return req
}

func TestListIndexesUsesTokens(t *testing.T) {
	indexes := ListIndexes()

	require.NotEmpty(t, indexes)
	for _, item := range indexes {
		require.NotEmpty(t, item.Text)
		require.NotContains(t, item.Token, "nccc_")
		require.Len(t, item.Token, 24)
	}
}

func TestResolveIndexToken(t *testing.T) {
	token := indexToken("income")

	key, info, ok := ResolveIndexToken(token)

	require.True(t, ok)
	require.Equal(t, "income", key)
	require.Equal(t, token, info.Token)
	require.NotEmpty(t, info.Text)

	_, _, ok = ResolveIndexToken("income")
	require.False(t, ok)
}

func TestBuildRecordSearchQueryUsesOffsetBeforeCursor(t *testing.T) {
	query, err := buildRecordSearchQuery(recordSearchRequest(2, 30, ""))

	require.NoError(t, err)
	require.Equal(t, int64(30), query["from"])
	require.NotContains(t, query, "search_after")
}

func TestBuildRecordSearchQueryUsesSearchAfterCursor(t *testing.T) {
	cursor, err := helper.EncodeESCursor(helper.ESCursor{
		SearchAfter: []any{float64(123)},
		Offset:      30,
	})
	require.NoError(t, err)

	query, err := buildRecordSearchQuery(recordSearchRequest(1, 30, cursor))

	require.NoError(t, err)
	require.NotContains(t, query, "from")
	require.Equal(t, []any{float64(123)}, query["search_after"])
}

func TestBuildRecordSearchQueryCapsPerPage(t *testing.T) {
	query, err := buildRecordSearchQuery(recordSearchRequest(1, 200, ""))

	require.NoError(t, err)
	require.Equal(t, int64(maxRecordPerPage), query["size"])
}

func TestBuildRecordSearchQueryAddsFilters(t *testing.T) {
	req := recordSearchRequest(1, 30, "")
	req.YearMonths = "113年01月,113年02月"
	req.Region = "台北市"
	req.Category = "食"
	req.Filters = `{"性別":["1","2"],"年齡層":["20(含)-25歲","25(含)-30歲"]}`

	query, err := buildRecordSearchQuery(req)

	require.NoError(t, err)
	require.Contains(t, query, "query")
	require.NotContains(t, query, "aggs")
	require.NotContains(t, query, "post_filter")
	body, err := jsonMarshal(query)
	require.NoError(t, err)
	require.Contains(t, body, `"年月.keyword":["113年01月","113年02月"]`)
	require.Contains(t, body, `"地區.keyword":["台北市"]`)
	require.Contains(t, body, `"類別.keyword":["食"]`)
	require.Contains(t, body, `"性別.keyword":["1","2"]`)
	require.Contains(t, body, `"年齡層.keyword":["20(含)-25歲","25(含)-30歲"]`)

	queryBody, err := jsonMarshal(query["query"])
	require.NoError(t, err)
	require.Contains(t, queryBody, "地區.keyword")
}

func TestParseFieldFiltersAcceptsLegacySingleValue(t *testing.T) {
	filters, err := parseFieldFilters(`{"性別":"1"}`)

	require.NoError(t, err)
	require.Equal(t, []string{"1"}, filters["性別"])
}

func TestParseYearMonthFiltersRejectsInvalidFormat(t *testing.T) {
	_, err := parseYearMonthFilters("2024-01")
	require.Error(t, err)
}

func TestBuildRecordSearchQueryRejectsUnsupportedFilter(t *testing.T) {
	req := recordSearchRequest(1, 30, "")
	req.Filters = `{"信用卡交易筆數":"68"}`

	_, err := buildRecordSearchQuery(req)

	require.Error(t, err)
}

func jsonMarshal(input any) (string, error) {
	body, err := json.Marshal(input)
	return string(body), err
}
