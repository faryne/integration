package rates

import (
	"context"
	"encoding/json"
	"net/http"

	ratesEntity "faryne.dev/model/entity/opendata/rates"
)

const (
	megaURL = "https://www.megabank.com.tw/api/services/ExchangeServices.aspx/CallAPI"
	// args 本身是一段 JSON 字串（ASP.NET PageMethod 的格式）
	megaBody = `{"args":"{\"service_name\":\"ex_rate_new\",\"args\":{}}"}`
)

// 兆豐回傳 {"d": "<再 encode 一次的 JSON>"}，要解兩層
type megaInner struct {
	ExRateNew struct {
		LastUpdate string `json:"last_update"` // 2026/10/22 16:28:12
		Currs      []struct {
			CurrName string `json:"curr_name"`
			Rates    struct {
				CashBid string `json:"cashbidlistrate"`
				CashAsk string `json:"cashasklistrate"`
			} `json:"rates"`
		} `json:"currs"`
	} `json:"ex_rate_new"`
}

func fetchMega(ctx context.Context) ([]ratesEntity.RateRecord, error) {
	body, err := fetch(ctx, http.MethodPost, megaURL, megaBody, map[string]string{"Content-Type": "application/json"})
	if err != nil {
		return nil, err
	}
	return parseMega(body)
}

func parseMega(body []byte) ([]ratesEntity.RateRecord, error) {
	var outer struct {
		D string `json:"d"`
	}
	if err := json.Unmarshal(body, &outer); err != nil {
		return nil, err
	}
	var inner megaInner
	if err := json.Unmarshal([]byte(outer.D), &inner); err != nil {
		return nil, err
	}
	b := newRecordBuilder(parseDate("2006/01/02 15:04:05", inner.ExRateNew.LastUpdate))
	for _, c := range inner.ExRateNew.Currs {
		b.add(c.CurrName, c.Rates.CashBid, c.Rates.CashAsk)
	}
	return b.records, nil
}
