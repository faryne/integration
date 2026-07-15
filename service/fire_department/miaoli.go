package fire_department

import "faryne.dev/service/crawler"

const miaoliCaseListURL = "http://119mlfire.mlfd.gov.tw:8080/DTS/caselist/html"

func Miaoli() ([]Event, error) {
	return crawlDataTableCases(dataTableCaseConfig{
		Source:        "miaoli",
		URL:           miaoliCaseListURL,
		TimeColumn:    2,
		TypeColumn:    3,
		AddressColumn: 4,
		CarsColumn:    5,
		StatusColumn:  6,
		Crawl:         crawler.CrawlByURLInTaiwanWithTimeout,
	})
}
