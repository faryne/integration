package taipower

import (
	"regexp"
	"strings"
)

var countyCities = []string{
	"臺北市", "台北市", "新北市", "桃園市", "臺中市", "台中市",
	"臺南市", "台南市", "高雄市", "基隆市", "新竹市", "嘉義市",
	"宜蘭縣", "新竹縣", "苗栗縣", "彰化縣", "南投縣", "雲林縣",
	"嘉義縣", "屏東縣", "花蓮縣", "臺東縣", "台東縣", "澎湖縣",
	"金門縣", "連江縣", "臺北縣", "台北縣", "桃園縣", "臺中縣",
	"台中縣", "臺南縣", "台南縣", "高雄縣",
}

var administrativeAreaPattern = regexp.MustCompile(`^[^鄉鎮市區]+[鄉鎮市區]$`)

func normalizeCityArea(cityArea string, unit string) string {
	cityArea = strings.TrimSpace(cityArea)
	if cityArea == "" || findCountyCity(cityArea) != "" {
		return cityArea
	}
	countyCity := findCountyCity(unit)
	if countyCity == "" {
		return cityArea
	}
	return countyCity + cityArea
}

func isValidCityArea(cityArea string) bool {
	countyCity := findCountyCity(cityArea)
	if countyCity == "" || !strings.HasPrefix(cityArea, countyCity) {
		return false
	}
	administrativeArea := strings.TrimPrefix(cityArea, countyCity)
	return administrativeAreaPattern.MatchString(administrativeArea)
}

func findCountyCity(value string) string {
	for _, countyCity := range countyCities {
		if strings.Contains(value, countyCity) {
			return countyCity
		}
	}
	return ""
}
