package rates

import (
	"context"
	"encoding/json"
	"net/http"
	"regexp"
	"time"

	ratesEntity "faryne.dev/model/entity/opendata/rates"
)

// 不帶 exchangeType 回的是即期匯率，要指定 CASH 才是現鈔
const sinopacURL = "https://m.sinopac.com/ws/share/rate/ws_exchange.ashx?exchangeType=CASH"

// TitleInfo 是一段 HTML：「報價時間：2026-10-22 15:30:36<br>…」
var sinopacDatePattern = regexp.MustCompile(`\d{4}-\d{2}-\d{2}`)

// 欄位意義看 HeadInfo：DataValue2＝銀行買進、DataValue3＝銀行賣出、DataValue4＝幣別代碼；不提供現鈔時為 "-"
type sinopacResponse []struct {
	TitleInfo string `json:"TitleInfo"`
	SubInfo   []struct {
		Buy  string `json:"DataValue2"`
		Sell string `json:"DataValue3"`
		Code string `json:"DataValue4"`
	} `json:"SubInfo"`
}

func fetchSinopac(ctx context.Context) ([]ratesEntity.RateRecord, error) {
	body, err := fetch(ctx, http.MethodGet, sinopacURL, "", nil)
	if err != nil {
		return nil, err
	}
	return parseSinopac(body)
}

func parseSinopac(body []byte) ([]ratesEntity.RateRecord, error) {
	var resp sinopacResponse
	if err := json.Unmarshal(body, &resp); err != nil {
		return nil, err
	}
	if len(resp) == 0 {
		return nil, nil
	}
	b := newRecordBuilder(parseDate(time.DateOnly, sinopacDatePattern.FindString(resp[0].TitleInfo)))
	for _, row := range resp[0].SubInfo {
		b.add(row.Code, row.Buy, row.Sell)
	}
	return b.records, nil
}
