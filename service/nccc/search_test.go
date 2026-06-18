package nccc

import (
	"encoding/json"
	"testing"

	"faryne.dev/model/entity"
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

	query, err := buildRecordSearchQuery(req)

	require.NoError(t, err)
	require.Contains(t, query, "aggs")
	require.Contains(t, query, "query")
	body, err := jsonMarshal(query)
	require.NoError(t, err)
	require.Contains(t, body, `"年月.keyword":["113年01月","113年02月"]`)
	require.Contains(t, body, `"地區.keyword":"台北市"`)
	require.Contains(t, body, `"類別.keyword":"食"`)
}

func TestParseYearMonthFiltersRejectsInvalidFormat(t *testing.T) {
	_, err := parseYearMonthFilters("2024-01")
	require.Error(t, err)
}

func TestRecordFacets(t *testing.T) {
	raw := &entity.ElasticSearchResponse[map[string]any]{
		Aggregations: map[string]struct {
			Value    *float64 `json:"value,omitempty"`
			DocCount int      `json:"doc_count"`
			BgCount  int      `json:"bg_count"`
			Buckets  []struct {
				Key      string  `json:"key"`
				DocCount int     `json:"doc_count"`
				Score    float64 `json:"score"`
				BgCount  int     `json:"bg_count"`
			} `json:"buckets"`
		}{
			"regions": {
				Buckets: []struct {
					Key      string  `json:"key"`
					DocCount int     `json:"doc_count"`
					Score    float64 `json:"score"`
					BgCount  int     `json:"bg_count"`
				}{
					{Key: "台北市", DocCount: 12},
				},
			},
		},
	}

	facets := RecordFacets(raw)

	require.Equal(t, []ncccModel.FacetOption{{Value: "台北市", Count: 12}}, facets.Regions)
}

func jsonMarshal(input any) (string, error) {
	body, err := json.Marshal(input)
	return string(body), err
}
