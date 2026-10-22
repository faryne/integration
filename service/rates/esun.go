package rates

import (
	"bytes"
	"context"
	"encoding/json"
	"net/http"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"

	ratesEntity "faryne.dev/model/entity/opendata/rates"
)

const esunURL = "https://www.esunbank.com/zh-tw/personal/deposit/rate/forex/foreign-exchange-rates"

// 玉山頁面內嵌 schema.org JSON-LD，每個幣別×匯率種類×買賣方向各一筆，
// name 形如「美元 現金匯率 銀行買入」；比解 DOM 穩，改版也比較不會動到
type esunLD struct {
	MainEntity struct {
		ItemListElement []struct {
			Name                string `json:"name"`
			Currency            string `json:"currency"`
			CurrentExchangeRate struct {
				Price     string `json:"price"`
				ValidFrom string `json:"validFrom"` // RFC3339
			} `json:"currentExchangeRate"`
		} `json:"itemListElement"`
	} `json:"mainEntity"`
}

func fetchEsun(ctx context.Context) ([]ratesEntity.RateRecord, error) {
	body, err := fetch(ctx, http.MethodGet, esunURL, "", nil)
	if err != nil {
		return nil, err
	}
	return parseEsun(body)
}

func parseEsun(body []byte) ([]ratesEntity.RateRecord, error) {
	doc, err := goquery.NewDocumentFromReader(bytes.NewReader(body))
	if err != nil {
		return nil, err
	}

	// 依幣別收集現金匯率的買／賣價，保留出現順序
	type pair struct{ buy, sell string }
	cash := map[string]*pair{}
	var order []string
	date := today()
	doc.Find(`script[type="application/ld+json"]`).Each(func(_ int, s *goquery.Selection) {
		var ld esunLD
		// 麵包屑等其他 JSON-LD 解出來是空的，忽略即可
		if json.Unmarshal([]byte(s.Text()), &ld) != nil {
			return
		}
		for _, item := range ld.MainEntity.ItemListElement {
			if !strings.Contains(item.Name, "現金匯率") {
				continue
			}
			if t, err := time.Parse(time.RFC3339, item.CurrentExchangeRate.ValidFrom); err == nil {
				date = t
			}
			p, ok := cash[item.Currency]
			if !ok {
				p = &pair{}
				cash[item.Currency] = p
				order = append(order, item.Currency)
			}
			switch {
			case strings.HasSuffix(item.Name, "銀行買入"):
				p.buy = item.CurrentExchangeRate.Price
			case strings.HasSuffix(item.Name, "銀行賣出"):
				p.sell = item.CurrentExchangeRate.Price
			}
		}
	})

	b := newRecordBuilder(date)
	for _, code := range order {
		b.add(code, cash[code].buy, cash[code].sell)
	}
	return b.records, nil
}
