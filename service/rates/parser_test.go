package rates

import (
	"os"
	"testing"
	"time"

	"github.com/stretchr/testify/require"

	ratesEntity "faryne.dev/model/entity/opendata/rates"
)

// testdata 是 2026-10-22 下午實際抓下來的回應（玉山、國泰只留解析會用到的片段）；官網改版時重抓覆蓋即可
func TestParsers(t *testing.T) {
	cases := []struct {
		file      string
		parse     func([]byte) ([]ratesEntity.RateRecord, error)
		rows      int
		buy, sell float64 // USD 現鈔
	}{
		{"land.json", parseLand, 7, 32.117, 32.827},
		{"mega.json", parseMega, 18, 32.11, 32.78},
		{"esun.html", parseEsun, 8, 32.27, 32.82},
		{"cathay.html", parseCathay, 5, 32.14, 32.84},
		{"sinopac.json", parseSinopac, 5, 32.36, 32.872},
		{"first.html", parseFirst, 8, 32.263, 32.778},
	}
	for _, c := range cases {
		t.Run(c.file, func(t *testing.T) {
			body, err := os.ReadFile("testdata/" + c.file)
			require.NoError(t, err)
			records, err := c.parse(body)
			require.NoError(t, err)
			require.Len(t, records, c.rows)

			usd := records[0]
			for _, r := range records {
				if r.Base == "USD" {
					usd = r
				}
				// 報價日期要取自來源，而不是跑測試的這天
				require.Equal(t, "2026-10-22", r.RecordDate)
				require.Less(t, r.BuyRate, r.SellRate)
			}
			require.Equal(t, "USD", usd.Base)
			require.Equal(t, c.buy, usd.BuyRate)
			require.Equal(t, c.sell, usd.SellRate)
		})
	}
}

func TestRecordBuilderSkipsInvalid(t *testing.T) {
	b := newRecordBuilder(time.Date(2026, 10, 22, 23, 30, 0, 0, time.UTC)) // UTC 23:30＝台灣隔天
	b.add("usd", " 32.123456 ", "32,800")
	b.add("GBP", "0", "0")     // 土銀：不提供現鈔
	b.add("CHF", "-", "-")     // 永豐：不提供現鈔
	b.add("ZAR", "", "")       // 兆豐：不提供現鈔
	b.add("SEK", "3.5", "3.2") // 買 ≥ 賣，來源異常
	b.add("", "1", "2")

	require.Equal(t, []ratesEntity.RateRecord{{
		Base: "USD", BuyRate: 32.12346, SellRate: 32800, RecordDate: "2026-10-23",
	}}, b.records)
}
