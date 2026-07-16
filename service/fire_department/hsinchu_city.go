package fire_department

import "faryne.dev/service/crawler"

const hsinchuCityCaseListURL = "https://119.hcfd.gov.tw/DTS/caselist/html"

func HsinchuCity() ([]Event, error) {
	return crawlDataTableCases(dataTableCaseConfig{
		Source:        "hsinchu_city",
		URL:           hsinchuCityCaseListURL,
		TimeColumn:    2,
		TypeColumn:    3,
		AddressColumn: 4,
		CarsColumn:    5,
		StatusColumn:  6,
		Crawl:         crawler.CrawlByUrlWithTimeout,
	})
}
