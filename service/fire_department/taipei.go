package fire_department

import (
	"encoding/json"
	"math"
	"net/http"
	"time"
)

type TaipeiResponse struct {
	Total int                 `json:"total"`
	Rows  []TaipeiResponseRow `json:"rows"`
}

type TaipeiResponseRow struct {
	InTime       string  `json:"inTime"`
	DpKdid       string  `json:"dpKdid"`
	CsKindName   string  `json:"csKindName"`
	CsCodeName   string  `json:"csCodeName"`
	CaseStatus   string  `json:"caseStatus"`
	CsPlaceFuzzy string  `json:"csPlaceFuzzy"`
	FuzzyAble    string  `json:"fuzzyAble"`
	FuzzyX       float64 `json:"fuzzyX"`
	FuzzyY       float64 `json:"fuzzyY"`
}

func Twd97ToWGS84(x, y float64) (float64, float64) {
	ty := y * 0.00000899823754
	tx := 121 + (x-250000)*0.000008983152841195214/math.Cos(ty*(math.Pi/180))

	return tx, ty
}
func Taipei() ([]Event, error) {
	req, err := http.NewRequest(http.MethodPost, "https://service119.tfd.gov.tw/service119/citizenCase/caseList", nil)
	if err != nil {
		return nil, err
	}
	// TWD97 -> WGS84：https://wiki.openstreetmap.org/wiki/Zh-hant:key_formulas_and_constants?#TWD97_.E8.BD.89_WGS84
	return Fetch(req, func(input []byte) ([]Event, error) {
		var respContent TaipeiResponse
		if err := json.Unmarshal(input, &respContent); err != nil {
			return nil, err
		}
		var out = make([]Event, respContent.Total)
		for k, row := range respContent.Rows {
			t, err := time.Parse("2006/01/02 15:04:05", row.InTime)
			if err != nil {
				return nil, err
			}
			tx, ty := Twd97ToWGS84(row.FuzzyX, row.FuzzyY)
			out[k] = Event{
				Lng:          ty,
				Lat:          tx,
				Type:         row.CsKindName,
				SubType:      row.CsCodeName,
				Title:        row.DpKdid,
				EndpointInfo: row.CsPlaceFuzzy,
				Cars:         make([]string, 0),
				Timestamp:    t.Unix(),
			}
		}
		return out, nil
	})
}
