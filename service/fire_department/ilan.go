package fire_department

import "faryne.dev/service/crawler"

const ilanCaseListURL = "https://nfa119.e-land.gov.tw/DTS/caselist/html"

func Ilan() ([]Event, error) {
	return crawlDataTableCases(dataTableCaseConfig{
		Source:        "ilan",
		URL:           ilanCaseListURL,
		TimeColumn:    2,
		TypeColumn:    3,
		SubTypeColumn: 4,
		AddressColumn: 5,
		CarsColumn:    6,
		StatusColumn:  7,
		Crawl:         crawler.CrawlByURLInTaiwanWithTimeout,
	})
}
