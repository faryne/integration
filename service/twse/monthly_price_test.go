package twse

import (
	"testing"
	"time"

	"faryne.dev/config"
	"faryne.dev/model/enum"
	"faryne.dev/service/client"
	"github.com/joho/godotenv"
	"github.com/stretchr/testify/require"
)

func TestETFMonthlyPriceService_GetByYear(t *testing.T) {
	_ = godotenv.Load("../../.env")
	config.InitEnvConfig()
	_ = client.InitMySql(enum.DBWalolita, config.EnvConfig().WalolitaDSN)

	s := NewETFMonthlyPriceService()

	// 測試一個已知的 ETF 代碼和年份，如果資料庫中沒有資料，至少不應報錯
	res, err := s.GetByYear("0050", 2024)
	require.NoError(t, err)

	t.Logf("Found %d records for 0050 in 2024", len(res))
	for _, r := range res {
		t.Logf("Month: %d, AvgPrice: %f", r.Month, r.AvgPrice)
	}
}

func TestETFMonthlyPriceService_UpdateMonthlyPriceByMonth(t *testing.T) {
	_ = godotenv.Load("../../.env")
	config.InitEnvConfig()
	_ = client.InitMySql(enum.DBWalolita, config.EnvConfig().WalolitaDSN)

	s := NewETFMonthlyPriceService()

	// 測試 2024 年 1 月的統計
	err := s.UpdateMonthlyPriceByMonth(2024, 1)
	require.NoError(t, err)

	// 測試指定 code 的統計
	err = s.UpdateMonthlyPriceByMonth(2024, 1, "0050")
	require.NoError(t, err)
}

func TestETFMonthlyPriceService_UpdateAllMonthlyPrices(t *testing.T) {
	// 注意：這個測試會執行大量更新，僅在需要時手動開啟
	//t.Skip("Skip heavy update test")

	_ = godotenv.Load("../../.env")
	config.InitEnvConfig()
	_ = client.InitMySql(enum.DBWalolita, config.EnvConfig().WalolitaDSN)

	s := NewETFMonthlyPriceService()
	codeList, err := GetCodeList()
	require.NoError(t, err)

	// 測試指定 code 的全量統計
	for _, v := range codeList {
		updateAvgMonthlyError := s.UpdateAllMonthlyPrices(v.Code)
		require.NoError(t, updateAvgMonthlyError)
		time.Sleep(3 * time.Second)
	}
}
