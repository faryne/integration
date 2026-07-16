package fire_department

import "faryne.dev/service/crawler"

const keelungCaseListURL = "https://klc-dt.klfd.klcg.gov.tw/DTS/caselist/html"

func Keelung() ([]Event, error) {
	return crawlDataTableCases(dataTableCaseConfig{
		Source:        "keelung",
		URL:           keelungCaseListURL,
		TimeColumn:    2,
		TypeColumn:    3,
		SubTypeColumn: 4,
		AddressColumn: 5,
		CarsColumn:    6,
		StatusColumn:  7,
		Crawl:         crawler.CrawlByURLInTaiwanWithTimeout,
	})
}
