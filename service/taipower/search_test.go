package taipower

import (
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

func TestBuildNeighborSearchQueryPathOverridesYearMonthRange(t *testing.T) {
	query, err := buildNeighborSearchQuery(taipowerModel.NeighborSearchRequest{
		YearMonthFrom: "invalid",
		YearMonthTo:   "invalid",
	}, NeighborSearchFilter{Year: 115, Month: 5})

	require.NoError(t, err)
	require.NotNil(t, query["query"])
}

func TestParseNeighborPath(t *testing.T) {
	filter, err := ParseNeighborPath("115", "5")
	require.NoError(t, err)
	require.Equal(t, NeighborSearchFilter{Year: 115, Month: 5}, filter)

	filter, err = ParseNeighborPath("1", "")
	require.NoError(t, err)
	require.Equal(t, 1, filter.Year)
	_, err = ParseNeighborPath("0", "")
	require.Error(t, err)
	_, err = ParseNeighborPath("115", "13")
	require.Error(t, err)
}

func TestBuildNeighborSearchQueryIncludesCityAreaAndUnit(t *testing.T) {
	query, err := buildNeighborSearchQuery(
		taipowerModel.NeighborSearchRequest{},
		NeighborSearchFilter{CityArea: "高雄市", Unit: "測試單位"},
	)

	require.NoError(t, err)
	require.NotNil(t, query["query"])
}
