package twse

import (
	"encoding/json"
	"faryne.dev/config"
	"github.com/joho/godotenv"
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

func Test_CronETFData(t *testing.T) {
	_ = godotenv.Load("/Users/faryne/projects/sideproject/faryne.dev/.env")
	config.InitEnvConfig()
	CronETFData()
}
