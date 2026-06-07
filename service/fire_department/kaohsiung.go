package fire_department

const kaohsiungCaseListURL = "https://119dts.fdkc.gov.tw/DTS/caselist/html"

func Kaohsiung() ([]Event, error) {
	return crawlDataTableCases(dataTableCaseConfig{
		Source:        "kaohsiung",
		URL:           kaohsiungCaseListURL,
		TimeColumn:    2,
		TypeColumn:    3,
		SubTypeColumn: 4,
		AddressColumn: 5,
		CarsColumn:    6,
		StatusColumn:  7,
	})
}
