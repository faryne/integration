package fire_department

import "faryne.dev/service/crawler"

const yunlinCaseListURL = "http://119.ylfire.gov.tw:8080/DTS/caselist/html"

func Yunlin() ([]Event, error) {
	return crawlDataTableCases(dataTableCaseConfig{
		Source:        "yunlin",
		URL:           yunlinCaseListURL,
		TimeColumn:    2,
		TypeColumn:    3,
		SubTypeColumn: 4,
		AddressColumn: 5,
		CarsColumn:    6,
		StatusColumn:  7,
		Crawl:         crawler.CrawlByURLInTaiwanWithTimeout,
	})
}
