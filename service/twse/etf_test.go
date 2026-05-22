package twse

import (
	"encoding/json"
	"testing"

	"faryne.dev/config"
	"faryne.dev/model/enum"
	"faryne.dev/service/client"
	"github.com/joho/godotenv"
	"github.com/stretchr/testify/require"
)

func Test_UpdateETFCodeList(t *testing.T) {
	_ = godotenv.Load("/Users/faryne/projects/sideproject/faryne.dev/.env")
	config.InitEnvConfig()
	_ = client.InitMySql(enum.DBWalolita, config.EnvConfig().WalolitaDSN)
	etfs, err := UpdateETFCodeList()
	require.NoError(t, err)
	require.NotEmpty(t, etfs)
	require.GreaterOrEqual(t, len(etfs), 10)
	c, _ := json.Marshal(etfs[1:3])
	t.Logf("%s\n", string(c))
	t.Logf("%+v\n", etfs)
}

func Test_GetETFTicker(t *testing.T) {
	_ = godotenv.Load("/Users/faryne/projects/sideproject/faryne.dev/.env")
	config.InitEnvConfig()
	_ = client.InitMySql(enum.DBWalolita, config.EnvConfig().WalolitaDSN)
	UpdateETFTicker("twse", "2005-01-01")
	//UpdateETFTicker("otc", "2005-01-01")
}

func Test_GetETFShare(t *testing.T) {
	_ = godotenv.Load("/Users/faryne/projects/sideproject/faryne.dev/.env")
	config.InitEnvConfig()
	_ = client.InitMySql(enum.DBWalolita, config.EnvConfig().WalolitaDSN)
	//UpdateETFShare("twse")
	UpdateETFShare("otc")
}

func Test_CreateCodeListFile(t *testing.T) {
	_ = godotenv.Load("/Users/faryne/projects/sideproject/faryne.dev/.env")
	config.InitEnvConfig()
	_ = client.InitMySql(enum.DBWalolita, config.EnvConfig().WalolitaDSN)
	CreateCodeListFile()
}

func Test_UpdateExPriceAndYieldRate(t *testing.T) {
	_ = godotenv.Load("/Users/faryne/projects/sideproject/faryne.dev/.env")
	config.InitEnvConfig()
	_ = client.InitMySql(enum.DBWalolita, config.EnvConfig().WalolitaDSN)
	UpdateExPriceAndYieldRate()
}

func Test_UpdateFilledDays(t *testing.T) {
	_ = godotenv.Load("/Users/faryne/projects/sideproject/faryne.dev/.env")
	config.InitEnvConfig()
	_ = client.InitMySql(enum.DBWalolita, config.EnvConfig().WalolitaDSN)
	UpdateFilledDays()
}

func Test_UpdateETFWinRate(t *testing.T) {
	_ = godotenv.Load("/Users/faryne/projects/sideproject/faryne.dev/.env")
	config.InitEnvConfig()
	_ = client.InitMySql(enum.DBWalolita, config.EnvConfig().WalolitaDSN)
	UpdateETFWinRate()
}

func Test_NotifyUpcomingETFEx(t *testing.T) {
	_ = godotenv.Load("/Users/faryne/projects/sideproject/faryne.dev/.env")
	config.InitEnvConfig()
	_ = client.InitMySql(enum.DBWalolita, config.EnvConfig().WalolitaDSN)
	err := NotifyUpcomingETFEx("2026-05-19")
	require.NoError(t, err)
}
