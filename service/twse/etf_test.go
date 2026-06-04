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

func TestParseTWSEHistoryDivRow(t *testing.T) {
	row := []any{
		"元大台灣50",
		"0050",
		"民國113年01月17日",
		"foo",
		"民國113年02月21日",
		"3.5",
	}

	share, ok := parseTWSEHistoryDivRow("0050", row)

	require.True(t, ok)
	require.Equal(t, "0050", share.Code)
	require.Equal(t, "2024-01-17", share.ExDate)
	require.Equal(t, "2024-02-21", share.PayableDate)
	require.Equal(t, 3.5, share.Share)
	require.Equal(t, "1900-01-01", share.FilledDate)
}

func TestParseTWSEHistoryDivRowAllowsNilDistribution(t *testing.T) {
	row := []any{
		"元大台灣50",
		"0050",
		"民國113年01月17日",
		"foo",
		"民國113年02月21日",
		nil,
	}

	share, ok := parseTWSEHistoryDivRow("0050", row)

	require.True(t, ok)
	require.Equal(t, 0.0, share.Share)
}

func TestParseTWSEHistoryDivRowSkipsInvalidRows(t *testing.T) {
	tests := []struct {
		name string
		row  []any
	}{
		{
			name: "missing fields",
			row:  []any{"元大台灣50", "0050"},
		},
		{
			name: "nil ex date",
			row:  []any{"元大台灣50", "0050", nil, "foo", "民國113年02月21日", "3.5"},
		},
		{
			name: "nil payable date",
			row:  []any{"元大台灣50", "0050", "民國113年01月17日", "foo", nil, "3.5"},
		},
		{
			name: "invalid ex date",
			row:  []any{"元大台灣50", "0050", "bad", "foo", "民國113年02月21日", "3.5"},
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, ok := parseTWSEHistoryDivRow("0050", tt.row)
			require.False(t, ok)
		})
	}
}

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

func Test_UpdateETFTechnicalIndicators(t *testing.T) {
	_ = godotenv.Load("/Users/faryne/projects/sideproject/faryne.dev/.env")
	config.InitEnvConfig()
	_ = client.InitMySql(enum.DBWalolita, config.EnvConfig().WalolitaDSN)
	UpdateETFTechnicalIndicators("twse", "2026-06-03")
	UpdateETFTechnicalIndicators("otc", "2026-06-03")
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
