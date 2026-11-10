package taipower

import (
	"encoding/json"
	"testing"

	taipowerModel "faryne.dev/model/entity/opendata/taipower"
	"github.com/stretchr/testify/require"
)

func TestBuildNeighborSearchQueryRejectsInvalidRanges(t *testing.T) {
	costFrom := 20.0
	costTo := 10.0
	_, err := buildNeighborSearchQuery(taipowerModel.NeighborSearchRequest{
		CostFrom: &costFrom,
		CostTo:   &costTo,
	}, NeighborSearchFilter{})
	require.Error(t, err)

	_, err = buildNeighborSearchQuery(taipowerModel.NeighborSearchRequest{
		YearMonthFrom: "2026-05",
		YearMonthTo:   "2026-04",
	}, NeighborSearchFilter{})
	require.Error(t, err)
}

func TestBuildNeighborSearchQueryAllowsSameMonthRange(t *testing.T) {
	_, err := buildNeighborSearchQuery(taipowerModel.NeighborSearchRequest{
		YearMonthFrom: "2026-04",
		YearMonthTo:   "2026-04",
	}, NeighborSearchFilter{})

	require.NoError(t, err)
}

func TestBuildNeighborSearchQuerySupportsSelectedMonths(t *testing.T) {
	query, err := buildNeighborSearchQuery(taipowerModel.NeighborSearchRequest{
		YearMonths:    "2020-01,2021-10",
		YearMonthFrom: "invalid",
	}, NeighborSearchFilter{})

	require.NoError(t, err)
	require.NotNil(t, query["query"])
}

func TestBuildNeighborSearchQuerySupportsCashSort(t *testing.T) {
	query, err := buildNeighborSearchQuery(
		taipowerModel.NeighborSearchRequest{Sort: "cash_desc"},
		NeighborSearchFilter{},
	)

	require.NoError(t, err)
	sortConditions := query["sort"].([]map[string]any)
	require.Equal(t, map[string]any{"cash": map[string]any{"order": "desc"}}, sortConditions[0])

	_, err = buildNeighborSearchQuery(
		taipowerModel.NeighborSearchRequest{Sort: "summary_desc"},
		NeighborSearchFilter{},
	)
	require.Error(t, err)
}

func TestBuildNeighborSearchQueryPathOverridesYearMonthRange(t *testing.T) {
	query, err := buildNeighborSearchQuery(taipowerModel.NeighborSearchRequest{
		YearMonthFrom: "invalid",
		YearMonthTo:   "invalid",
	}, NeighborSearchFilter{Year: 2026, Month: 5})

	require.NoError(t, err)
	require.NotNil(t, query["query"])
}

func TestParseNeighborPath(t *testing.T) {
	filter, err := ParseNeighborPath("2026", "5")
	require.NoError(t, err)
	require.Equal(t, NeighborSearchFilter{Year: 2026, Month: 5}, filter)

	filter, err = ParseNeighborPath("1", "")
	require.NoError(t, err)
	require.Equal(t, 1, filter.Year)
	_, err = ParseNeighborPath("0", "")
	require.Error(t, err)
	_, err = ParseNeighborPath("2026", "13")
	require.Error(t, err)
}

func TestParseYearMonthUsesGregorianYear(t *testing.T) {
	yearMonth, err := parseYearMonth("2026-05")

	require.NoError(t, err)
	require.Equal(t, 202605, yearMonth)
}

func TestBuildNeighborSearchQueryIncludesCityAreaAndUnit(t *testing.T) {
	query, err := buildNeighborSearchQuery(
		taipowerModel.NeighborSearchRequest{},
		NeighborSearchFilter{CityArea: "台中市龍井區", Unit: "台中市龍井區公所"},
	)

	require.NoError(t, err)
	require.NotNil(t, query["query"])
	encoded, err := json.Marshal(query)
	require.NoError(t, err)
	require.Contains(t, string(encoded), `"cityarea_key":"臺中市龍井區"`)
	require.Contains(t, string(encoded), `"unit_key":"臺中市龍井區公所"`)
}

func TestBuildNeighborSearchQueryValidatesPurpose(t *testing.T) {
	_, err := buildNeighborSearchQuery(taipowerModel.NeighborSearchRequest{Purpose: "energy"}, NeighborSearchFilter{})
	require.NoError(t, err)
	_, err = buildNeighborSearchQuery(taipowerModel.NeighborSearchRequest{Purpose: "invalid"}, NeighborSearchFilter{})
	require.Error(t, err)
}

func TestBuildNeighborSearchQueryKeepsCountyWidePath(t *testing.T) {
	query, err := buildNeighborSearchQuery(taipowerModel.NeighborSearchRequest{}, NeighborSearchFilter{CityArea: "台中市"})
	require.NoError(t, err)
	encoded, err := json.Marshal(query)
	require.NoError(t, err)
	require.Contains(t, string(encoded), `"prefix":{"cityarea_key":"臺中市"}`)
}
