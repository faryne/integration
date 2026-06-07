package fire_department

const tainanCaseListURL = "https://119dts.tncfd.gov.tw/DTS/caselist/html"

func Tainan() ([]Event, error) {
	return crawlDataTableCases(dataTableCaseConfig{
		Source:        "tainan",
		URL:           tainanCaseListURL,
		CaseIDColumn:  2,
		TimeColumn:    3,
		TypeColumn:    4,
		AddressColumn: 5,
		CarsColumn:    6,
		StatusColumn:  7,
	})
}
