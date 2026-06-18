package nccc

import (
	"testing"

	"github.com/stretchr/testify/require"
)

func TestNCCCIndexName(t *testing.T) {
	require.Equal(t, "nccc_income", ncccIndexName("income"))
}

func TestDataSetKeysSorted(t *testing.T) {
	keys := dataSetKeys()

	require.NotEmpty(t, keys)
	require.Equal(t, "age", keys[0])
	require.Contains(t, keys, "income")
}

func TestSelectDataSetKeys(t *testing.T) {
	keys, err := selectDataSetKeys("income")
	require.NoError(t, err)
	require.Equal(t, []string{"income"}, keys)

	keys, err = selectDataSetKeys("")
	require.NoError(t, err)
	require.Greater(t, len(keys), 1)

	_, err = selectDataSetKeys("bad")
	require.Error(t, err)
}
