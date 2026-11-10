package taipower

import (
	"context"
	"testing"

	taipowerModel "faryne.dev/model/entity/opendata/taipower"
	"github.com/stretchr/testify/require"
)

func TestIndexNeighborsRejectsMissingMySQLID(t *testing.T) {
	err := indexNeighborsToIndex(context.Background(), neighborIndexName, []taipowerModel.Neighbor{{ObjYear: 2026, ObjMonth: 10, ObjMonthID: 1}})
	require.ErrorContains(t, err, "without MySQL id")
}
