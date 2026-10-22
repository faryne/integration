package rates

import (
	"context"
	"encoding/json"
	"net/http"

	ratesEntity "faryne.dev/model/entity/opendata/rates"
)

const landURL = "https://mybank.landbank.com.tw/SIGN/SIGN_finf_01/GetSCExchangeRates"

// 土銀回傳的 CashBuy / CashSell 為 "0" 代表不提供該幣別現鈔
type landResponse struct {
	Result []struct {
		CCY      string `json:"CCY"`
		CashBuy  string `json:"CashBuy"`
		CashSell string `json:"CashSell"`
		QuoDate  string `json:"QuoDate"` // 2026/10/22 16:28:00
	} `json:"RESULT"`
}

func fetchLand(ctx context.Context) ([]ratesEntity.RateRecord, error) {
	body, err := fetch(ctx, http.MethodGet, landURL, "", nil)
	if err != nil {
		return nil, err
	}
	return parseLand(body)
}

func parseLand(body []byte) ([]ratesEntity.RateRecord, error) {
	var resp landResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, err
	}
	if len(resp.Result) == 0 {
		return nil, nil
	}
	b := newRecordBuilder(parseDate("2006/01/02 15:04:05", resp.Result[0].QuoDate))
	for _, row := range resp.Result {
		b.add(row.CCY, row.CashBuy, row.CashSell)
	}
	return b.records, nil
}
