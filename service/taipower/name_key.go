package taipower

import "strings"

const (
	neighborNormalizationVersion = "1"
	unknownCityAreaKey           = "未辨識行政區"
)

var unitCityNameReplacer = strings.NewReplacer(
	"台北市", "臺北市", "台北縣", "臺北縣",
	"台中市", "臺中市", "台中縣", "臺中縣",
	"台南市", "臺南市", "台南縣", "臺南縣",
	"台東縣", "臺東縣",
)

// cityAreaKey 僅整理已辨識的行政區，保留改制前後的不同地名。
func cityAreaKey(cityArea, unit string) string {
	name := normalizeCityArea(cityArea, unit)
	if !isValidCityArea(name) {
		return unknownCityAreaKey
	}
	return strings.ReplaceAll(name, "台", "臺")
}

// unitKey 只統一單位名稱中的縣市異體字，不更動其他「台」字。
func unitKey(unit string) string {
	return unitCityNameReplacer.Replace(strings.TrimSpace(unit))
}
