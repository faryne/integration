package twse

import (
	"encoding/json"
	"github.com/stretchr/testify/require"
	"testing"
)

func Test_GetETFCodeList(t *testing.T) {
	etfs, err := GetCodeList()
	require.NoError(t, err)
	require.NotEmpty(t, etfs)
	require.GreaterOrEqual(t, len(etfs), 10)
	c, _ := json.Marshal(etfs[1:3])
	t.Logf("%s\n", string(c))
	t.Logf("%+v\n", etfs)
}

func Test_GetHistoryDivByCode(t *testing.T) {
	shares, err := GetHistoryDivByCode("00878")
	require.NoError(t, err)
	require.NotEmpty(t, shares)
	require.GreaterOrEqual(t, len(shares), 10)
	t.Logf("%+v\n", shares)
}
