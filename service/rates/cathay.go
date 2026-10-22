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

const cathayURL = "https://www.cathaybk.com.tw/cathaybk/personal/product/deposit/currency-billboard/"

var (
	// 卡片標題形如「美元USD」，取結尾的幣別代碼
	cathayCodePattern = regexp.MustCompile(`[A-Z]{3}$`)
	// 「資料時間 Board time：2026年10月22日 16:28:45」
	cathayDatePattern = regexp.MustCompile(`(\d{4})年(\d{1,2})月(\d{1,2})日`)
)

func fetchCathay(ctx context.Context) ([]ratesEntity.RateRecord, error) {
	body, err := fetch(ctx, http.MethodGet, cathayURL, "", nil)
	if err != nil {
		return nil, err
	}
	return parseCathay(body)
}

// parseCathay 每個幣別一張 rateCard，卡片表格裡只有「現鈔匯率」那列是我們要的（目前只有 5 個幣別有）
func parseCathay(body []byte) ([]ratesEntity.RateRecord, error) {
	doc, err := goquery.NewDocumentFromReader(bytes.NewReader(body))
	if err != nil {
		return nil, err
	}

	date := today()
	if m := cathayDatePattern.FindStringSubmatch(doc.Find(".cubre-u-assistText").Text()); m != nil {
		date = parseDate("2006-1-2", m[1]+"-"+m[2]+"-"+m[3])
	}

	b := newRecordBuilder(date)
	doc.Find(".cubre-o-rateCard").Each(func(_ int, card *goquery.Selection) {
		code := cathayCodePattern.FindString(strings.TrimSpace(card.Find(".cubre-m-currency__name").Text()))
		card.Find("tbody tr").Each(func(_ int, tr *goquery.Selection) {
			if strings.TrimSpace(tr.Find(".cubre-m-rateTable__name").Text()) != "現鈔匯率" {
				return
			}
			tds := tr.Find("td")
			b.add(code, tds.Eq(1).Text(), tds.Eq(2).Text())
		})
	})
	return b.records, nil
}
