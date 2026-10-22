package rates

import (
	"bytes"
	"context"
	"net/http"
	"regexp"
	"strings"

	"github.com/PuerkitoBio/goquery"

	ratesEntity "faryne.dev/model/entity/opendata/rates"
)

const firstURL = "https://ibank.firstbank.com.tw/NetBank/7/0201.html"

// 「Effective Date of Data ： 2026/10/22 16:03:41」
var firstDatePattern = regexp.MustCompile(`\d{4}/\d{2}/\d{2}`)

func fetchFirst(ctx context.Context) ([]ratesEntity.RateRecord, error) {
	body, err := fetch(ctx, http.MethodGet, firstURL, "", nil)
	if err != nil {
		return nil, err
	}
	return parseFirst(body)
}

// parseFirst #table1 每個幣別兩列（Spot／Cash），欄位依序為幣別、類別、買入、賣出
func parseFirst(body []byte) ([]ratesEntity.RateRecord, error) {
	doc, err := goquery.NewDocumentFromReader(bytes.NewReader(body))
	if err != nil {
		return nil, err
	}

	b := newRecordBuilder(parseDate("2006/01/02", firstDatePattern.FindString(doc.Find(".locator2").Text())))
	doc.Find("#table1 tr").Each(func(_ int, tr *goquery.Selection) {
		tds := tr.Find("td")
		if tds.Length() < 4 || strings.TrimSpace(tds.Eq(1).Text()) != "Cash" {
			return
		}
		code, _ := tds.Eq(0).Find("img").Attr("alt")
		b.add(code, tds.Eq(2).Text(), tds.Eq(3).Text())
	})
	return b.records, nil
}
